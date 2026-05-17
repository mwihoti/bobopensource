import * as fs from 'fs';
import * as path from 'path';
import { FileParser } from '../utils/parser';
import { GitUtils } from '../utils/git';
import { logger } from '../utils/logger';
import {
  RepositoryInfo,
  ProjectStructure,
  DirectoryInfo,
  ComponentInfo,
  DetectedPattern,
  DependencyInfo,
  TechStack,
  CodeConvention,
  AnalysisConfig,
} from '../types';
import { GitHubClient } from '../utils/github';

export class RepositoryAnalyzer {
  private repoPath: string;
  private config: AnalysisConfig;
  private gitUtils: GitUtils;

  constructor(repoPath: string, config: AnalysisConfig) {
    this.repoPath = path.resolve(repoPath);
    this.config = config;
    this.gitUtils = new GitUtils(this.repoPath);

    if (!fs.existsSync(this.repoPath)) {
      throw new Error(`Repository path does not exist: ${this.repoPath}`);
    }
  }

  static async analyzeRemote(
    owner: string,
    repo: string,
    config: AnalysisConfig
  ): Promise<RepositoryInfo> {
    logger.progress('Analyzing remote repository structure');

    const github = new GitHubClient();
    const [repoMeta, readme, tree] = await Promise.all([
      github.getRepository(owner, repo),
      github.getReadme(owner, repo).catch(() => ''),
      github.getTree(owner, repo, repo).catch(async () => github.getTree(owner, repo, 'HEAD')),
    ]);

    const files = (tree.tree || [])
      .filter(entry => entry.type === 'blob')
      .map(entry => entry.path);

    const rootFiles = files.filter(file => !file.includes('/')).slice(0, 20);
    const directories = RepositoryAnalyzer.buildRemoteDirectories(files);
    const keyComponents = RepositoryAnalyzer.buildRemoteComponents(files, config);
    const entryPoints = RepositoryAnalyzer.buildRemoteEntryPoints(files);
    const readmeSummary = RepositoryAnalyzer.summarizeReadme(readme);

    logger.success('Remote repository analysis complete');

    return {
      path: `${owner}/${repo}`,
      name: repoMeta.name,
      source: 'remote',
      slug: repoMeta.full_name,
      type: RepositoryAnalyzer.detectRemoteProjectType(files, repoMeta.language, readme),
      overview: repoMeta.description || readmeSummary[0] || `${repoMeta.full_name} repository`,
      highlights: [
        ...(repoMeta.description ? [repoMeta.description] : []),
        ...readmeSummary.slice(0, 3),
      ].slice(0, 4),
      defaultBranch: repoMeta.default_branch,
      structure: {
        rootFiles,
        directories,
        keyComponents,
        entryPoints,
      },
      patterns: [],
      dependencies: {
        production: {},
        development: {},
        peerDependencies: {},
      },
      techStack: {
        language: repoMeta.language || RepositoryAnalyzer.detectLanguageFromFiles(files),
        framework: RepositoryAnalyzer.detectFrameworkFromFiles(files),
        packageManager: RepositoryAnalyzer.detectPackageManagerFromFiles(files),
      },
      conventions: [],
    };
  }

  /**
   * Analyze the repository
   */
  async analyze(): Promise<RepositoryInfo> {
    logger.progress('Analyzing repository structure');

    const structure = await this.analyzeStructure();
    const patterns = await this.detectPatterns();
    const dependencies = await this.analyzeDependencies();
    const techStack = await this.detectTechStack();
    const conventions = await this.detectConventions();

    logger.success('Repository analysis complete');

    return {
      path: this.repoPath,
      name: path.basename(this.repoPath),
      source: 'local',
      slug: await this.getRepositorySlug(),
      type: this.detectProjectType(techStack, structure),
      overview: this.buildLocalOverview(structure, techStack),
      highlights: this.buildLocalHighlights(structure, techStack),
      structure,
      patterns,
      dependencies,
      techStack,
      conventions,
    };
  }

  /**
   * Analyze project structure
   */
  private async analyzeStructure(): Promise<ProjectStructure> {
    const rootFiles = fs.readdirSync(this.repoPath)
      .filter(file => {
        const filePath = path.join(this.repoPath, file);
        return fs.statSync(filePath).isFile();
      });

    const directories = await this.analyzeDirectories();
    const keyComponents = await this.identifyKeyComponents();
    const entryPoints = this.findEntryPoints(rootFiles, directories);

    return {
      rootFiles,
      directories,
      keyComponents,
      entryPoints,
    };
  }

  private async getRepositorySlug(): Promise<string | undefined> {
    const remote = await this.gitUtils.getGitHubRemoteSlug();
    if (!remote) {
      return undefined;
    }

    return `${remote.owner}/${remote.repo}`;
  }

  private buildLocalOverview(structure: ProjectStructure, techStack: TechStack): string {
    const topDirs = structure.directories.slice(0, 3).map(dir => dir.path);
    const techSummary = [techStack.language, techStack.framework, techStack.buildTool].filter(Boolean).join(', ');
    const dirSummary = topDirs.length > 0 ? `Key areas: ${topDirs.join(', ')}` : 'Repository structure available locally.';
    return techSummary ? `${techSummary}. ${dirSummary}` : dirSummary;
  }

  private buildLocalHighlights(structure: ProjectStructure, techStack: TechStack): string[] {
    const highlights: string[] = [];
    if (techStack.framework) {
      highlights.push(`Framework: ${techStack.framework}`);
    }
    if (techStack.testFramework) {
      highlights.push(`Tests: ${techStack.testFramework}`);
    }
    if (structure.entryPoints.length > 0) {
      highlights.push(`Entry points: ${structure.entryPoints.slice(0, 3).join(', ')}`);
    }
    if (structure.directories.length > 0) {
      highlights.push(`Largest areas: ${structure.directories.slice(0, 3).map(dir => dir.path).join(', ')}`);
    }

    return highlights;
  }

  /**
   * Analyze directories
   */
  private async analyzeDirectories(): Promise<DirectoryInfo[]> {
    const directories: DirectoryInfo[] = [];
    const ignorePatterns = [
      'node_modules',
      'dist',
      'build',
      '.git',
      'coverage',
      '.next',
      '.nuxt',
      ...this.config.ignorePatterns,
    ];

    const scanDirectory = (dirPath: string, depth: number = 0): void => {
      if (depth > 3) return; // Limit depth

      const entries = fs.readdirSync(dirPath);

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const relativePath = path.relative(this.repoPath, fullPath);

        if (ignorePatterns.some(pattern => relativePath.includes(pattern))) {
          continue;
        }

        if (fs.statSync(fullPath).isDirectory()) {
          const files = this.countFiles(fullPath);
          
          directories.push({
            path: relativePath,
            fileCount: files,
            purpose: this.inferDirectoryPurpose(entry, relativePath),
            importance: this.assessDirectoryImportance(entry, files),
          });

          scanDirectory(fullPath, depth + 1);
        }
      }
    };

    scanDirectory(this.repoPath);
    return directories.sort((a, b) => b.fileCount - a.fileCount);
  }

  /**
   * Count files in directory
   */
  private countFiles(dirPath: string): number {
    let count = 0;
    const entries = fs.readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isFile()) {
        count++;
      } else if (stat.isDirectory() && entry !== 'node_modules') {
        count += this.countFiles(fullPath);
      }
    }

    return count;
  }

  /**
   * Infer directory purpose
   */
  private inferDirectoryPurpose(dirName: string, relativePath: string): string {
    const purposeMap: Record<string, string> = {
      src: 'Source code',
      lib: 'Library code',
      dist: 'Distribution/Build output',
      build: 'Build output',
      test: 'Test files',
      tests: 'Test files',
      __tests__: 'Test files',
      docs: 'Documentation',
      examples: 'Example code',
      scripts: 'Build/utility scripts',
      config: 'Configuration files',
      public: 'Public assets',
      assets: 'Static assets',
      components: 'UI Components',
      pages: 'Page components',
      routes: 'Route definitions',
      api: 'API endpoints',
      services: 'Service layer',
      utils: 'Utility functions',
      helpers: 'Helper functions',
      hooks: 'Custom hooks',
      store: 'State management',
      models: 'Data models',
      types: 'Type definitions',
      interfaces: 'Interface definitions',
      styles: 'Stylesheets',
      css: 'Stylesheets',
    };

    const lowerDirName = dirName.toLowerCase();
    return purposeMap[lowerDirName] || 'General purpose';
  }

  /**
   * Assess directory importance
   */
  private assessDirectoryImportance(dirName: string, fileCount: number): 'high' | 'medium' | 'low' {
    const highImportance = ['src', 'lib', 'components', 'pages', 'api', 'services'];
    const mediumImportance = ['utils', 'helpers', 'hooks', 'store', 'models', 'types'];

    if (highImportance.includes(dirName.toLowerCase()) || fileCount > 20) {
      return 'high';
    } else if (mediumImportance.includes(dirName.toLowerCase()) || fileCount > 5) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Identify key components
   */
  private async identifyKeyComponents(): Promise<ComponentInfo[]> {
    const components: ComponentInfo[] = [];
    const sourcePatterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];
    
    try {
      const files = await FileParser.findFiles(
        this.repoPath,
        sourcePatterns,
        this.config.ignorePatterns
      );

      for (const file of files.slice(0, 50)) { // Limit to first 50 files
        try {
          const content = FileParser.readFile(file);
          const imports = FileParser.extractImports(content);
          const exports = FileParser.extractExports(content);

          if (exports.length > 0) {
            components.push({
              path: FileParser.getRelativePath(file, this.repoPath),
              type: FileParser.detectFileType(file, content),
              dependencies: imports,
              exports,
            });
          }
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }
    } catch (error) {
      logger.warn('Could not analyze all components');
    }

    return components;
  }

  /**
   * Find entry points
   */
  private findEntryPoints(rootFiles: string[], directories: DirectoryInfo[]): string[] {
    const entryPoints: string[] = [];
    const entryPointPatterns = [
      'index.js',
      'index.ts',
      'main.js',
      'main.ts',
      'app.js',
      'app.ts',
      'server.js',
      'server.ts',
    ];

    // Check root files
    for (const file of rootFiles) {
      if (entryPointPatterns.includes(file.toLowerCase())) {
        entryPoints.push(file);
      }
    }

    // Check src directory
    const srcDir = directories.find(d => d.path === 'src' || d.path.startsWith('src/'));
    if (srcDir) {
      for (const pattern of entryPointPatterns) {
        const entryPath = path.join(this.repoPath, 'src', pattern);
        if (fs.existsSync(entryPath)) {
          entryPoints.push(`src/${pattern}`);
        }
      }
    }

    return entryPoints;
  }

  /**
   * Detect patterns in the codebase
   */
  private async detectPatterns(): Promise<DetectedPattern[]> {
    const patterns: DetectedPattern[] = [];
    const sourcePatterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];

    try {
      const files = await FileParser.findFiles(
        this.repoPath,
        sourcePatterns,
        this.config.ignorePatterns
      );

      const sampleFiles = files.slice(0, 30);
      let reactComponentCount = 0;
      let hooksCount = 0;
      let classComponentCount = 0;
      let asyncAwaitCount = 0;
      let promiseCount = 0;

      for (const file of sampleFiles) {
        try {
          const content = FileParser.readFile(file);

          if (content.includes('React.Component') || content.includes('extends Component')) {
            classComponentCount++;
          }
          if (content.match(/export\s+(?:default\s+)?function\s+\w+/) && 
              (file.endsWith('.tsx') || file.endsWith('.jsx'))) {
            reactComponentCount++;
          }
          if (content.match(/function\s+use[A-Z]\w+/) || content.match(/const\s+use[A-Z]\w+\s*=/)) {
            hooksCount++;
          }
          if (content.includes('async ') && content.includes('await ')) {
            asyncAwaitCount++;
          }
          if (content.includes('Promise') || content.includes('.then(')) {
            promiseCount++;
          }
        } catch {
          continue;
        }
      }

      if (reactComponentCount > 2) {
        patterns.push({
          name: 'Functional Components',
          description: 'React functional components pattern',
          examples: ['export default function Component() { ... }'],
          confidence: Math.min(reactComponentCount / sampleFiles.length, 1),
        });
      }

      if (hooksCount > 2) {
        patterns.push({
          name: 'Custom Hooks',
          description: 'React custom hooks pattern',
          examples: ['function useCustomHook() { ... }'],
          confidence: Math.min(hooksCount / sampleFiles.length, 1),
        });
      }

      if (classComponentCount > 2) {
        patterns.push({
          name: 'Class Components',
          description: 'React class-based components',
          examples: ['class Component extends React.Component { ... }'],
          confidence: Math.min(classComponentCount / sampleFiles.length, 1),
        });
      }

      if (asyncAwaitCount > promiseCount) {
        patterns.push({
          name: 'Async/Await',
          description: 'Modern async/await pattern for asynchronous operations',
          examples: ['async function fetchData() { await api.get(...) }'],
          confidence: Math.min(asyncAwaitCount / sampleFiles.length, 1),
        });
      }
    } catch (error) {
      logger.warn('Could not detect all patterns');
    }

    return patterns;
  }

  /**
   * Analyze dependencies
   */
  private async analyzeDependencies(): Promise<DependencyInfo> {
    const packageJsonPath = path.join(this.repoPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      return {
        production: {},
        development: {},
        peerDependencies: {},
      };
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      return {
        production: packageJson.dependencies || {},
        development: packageJson.devDependencies || {},
        peerDependencies: packageJson.peerDependencies || {},
      };
    } catch {
      return {
        production: {},
        development: {},
        peerDependencies: {},
      };
    }
  }

  /**
   * Detect tech stack
   */
  private async detectTechStack(): Promise<TechStack> {
    const packageJsonPath = path.join(this.repoPath, 'package.json');
    let packageJson: any = {};

    if (fs.existsSync(packageJsonPath)) {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    }

    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Detect language
    const language = fs.existsSync(path.join(this.repoPath, 'tsconfig.json'))
      ? 'TypeScript'
      : 'JavaScript';

    // Detect framework
    let framework: string | undefined;
    if (deps.react) framework = 'React';
    else if (deps.vue) framework = 'Vue';
    else if (deps.angular || deps['@angular/core']) framework = 'Angular';
    else if (deps.svelte) framework = 'Svelte';
    else if (deps.next) framework = 'Next.js';
    else if (deps.nuxt) framework = 'Nuxt.js';
    else if (deps.express) framework = 'Express';
    else if (deps.fastify) framework = 'Fastify';

    // Detect build tool
    let buildTool: string | undefined;
    if (deps.webpack) buildTool = 'Webpack';
    else if (deps.vite) buildTool = 'Vite';
    else if (deps.rollup) buildTool = 'Rollup';
    else if (deps.parcel) buildTool = 'Parcel';
    else if (deps.esbuild) buildTool = 'esbuild';

    // Detect test framework
    let testFramework: string | undefined;
    if (deps.jest) testFramework = 'Jest';
    else if (deps.mocha) testFramework = 'Mocha';
    else if (deps.vitest) testFramework = 'Vitest';
    else if (deps.jasmine) testFramework = 'Jasmine';

    // Detect package manager
    let packageManager = 'npm';
    if (fs.existsSync(path.join(this.repoPath, 'yarn.lock'))) packageManager = 'yarn';
    else if (fs.existsSync(path.join(this.repoPath, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
    else if (fs.existsSync(path.join(this.repoPath, 'bun.lockb'))) packageManager = 'bun';

    return {
      language,
      framework,
      buildTool,
      testFramework,
      packageManager,
    };
  }

  /**
   * Detect project type
   */
  private detectProjectType(techStack: TechStack, structure: ProjectStructure): string {
    if (techStack.framework) {
      return `${techStack.framework} Application`;
    }

    const hasApi = structure.directories.some(d => 
      d.path.includes('api') || d.path.includes('routes')
    );
    const hasComponents = structure.directories.some(d => 
      d.path.includes('components')
    );

    if (hasApi && hasComponents) return 'Full-stack Application';
    if (hasApi) return 'Backend API';
    if (hasComponents) return 'Frontend Application';

    return 'Library/Package';
  }

  /**
   * Detect code conventions
   */
  private async detectConventions(): Promise<CodeConvention[]> {
    const conventions: CodeConvention[] = [];

    // Check for ESLint
    const eslintConfig = ['.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml']
      .find(file => fs.existsSync(path.join(this.repoPath, file)));

    if (eslintConfig) {
      conventions.push({
        category: 'Linting',
        rule: 'ESLint configured',
        examples: [`Configuration file: ${eslintConfig}`],
      });
    }

    // Check for Prettier
    const prettierConfig = ['.prettierrc', '.prettierrc.js', '.prettierrc.json', 'prettier.config.js']
      .find(file => fs.existsSync(path.join(this.repoPath, file)));

    if (prettierConfig) {
      conventions.push({
        category: 'Formatting',
        rule: 'Prettier configured',
        examples: [`Configuration file: ${prettierConfig}`],
      });
    }

    // Check for TypeScript
    if (fs.existsSync(path.join(this.repoPath, 'tsconfig.json'))) {
      conventions.push({
        category: 'Type Safety',
        rule: 'TypeScript enabled',
        examples: ['Use TypeScript for type-safe code'],
      });
    }

    return conventions;
  }

  private static buildRemoteDirectories(files: string[]): DirectoryInfo[] {
    const counts = new Map<string, number>();

    for (const file of files) {
      const parts = file.split('/');
      for (let depth = 1; depth < Math.min(parts.length, 4); depth++) {
        const dir = parts.slice(0, depth).join('/');
        counts.set(dir, (counts.get(dir) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([dir, fileCount]) => ({
        path: dir,
        fileCount,
        purpose: RepositoryAnalyzer.inferStaticDirectoryPurpose(path.basename(dir)),
        importance: (fileCount > 20 ? 'high' : fileCount > 5 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
      }))
      .sort((a, b) => b.fileCount - a.fileCount)
      .slice(0, 30);
  }

  private static buildRemoteComponents(files: string[], config: AnalysisConfig): ComponentInfo[] {
    const ignorePatterns = new Set(config.ignorePatterns);
    const sourceFiles = files.filter(file =>
      /\.(ts|tsx|js|jsx|rs|go|py|java|kt|swift|rb|proto|md|toml|ya?ml)$/.test(file) &&
      !Array.from(ignorePatterns).some(pattern => file.includes(pattern.replace(/\*\*/g, '')))
    );

    const ranked = sourceFiles.sort((a, b) => RepositoryAnalyzer.scoreRemotePath(b) - RepositoryAnalyzer.scoreRemotePath(a));

    return ranked.slice(0, 80).map(file => ({
      path: file,
      type: RepositoryAnalyzer.detectRemoteFileType(file),
      dependencies: [],
      exports: [path.basename(file, path.extname(file))],
    }));
  }

  private static scoreRemotePath(filePath: string): number {
    let score = 0;
    if (/src|lib|packages|crates|tools|apps/.test(filePath)) score += 3;
    if (/index|main|app|server|cli|mod/.test(path.basename(filePath).toLowerCase())) score += 2;
    if (/protobuf|proto|schema|readme|archiver|replayer|alerts|event|message|connection/.test(filePath.toLowerCase())) score += 2;
    if (/test|spec|fixture|mock/.test(filePath)) score -= 2;
    return score;
  }

  private static buildRemoteEntryPoints(files: string[]): string[] {
    return files.filter(file => /(src\/)?(index|main|app|server|cli)\.(ts|tsx|js|jsx|rs|go|py)$/.test(file)).slice(0, 10);
  }

  private static summarizeReadme(readme: string): string[] {
    if (!readme) {
      return [];
    }

    return readme
      .split('\n')
      .map(line => line.replace(/^#+\s*/, '').trim())
      .filter(line => line.length > 30 && !line.startsWith('![') && !line.startsWith('```'))
      .slice(0, 4);
  }

  private static detectRemoteProjectType(files: string[], language: string | null, readme: string): string {
    const lowerReadme = readme.toLowerCase();
    if (files.some(file => file.includes('/api/') || file.includes('/routes/'))) {
      return 'Backend API';
    }
    if (files.some(file => file.includes('/components/') || file.endsWith('.tsx'))) {
      return 'Frontend Application';
    }
    if (files.some(file => file.startsWith('tools/') || file.startsWith('cmd/'))) {
      return 'Tooling/CLI';
    }
    if (lowerReadme.includes('sdk') || lowerReadme.includes('library')) {
      return 'Library/Package';
    }

    return language ? `${language} Project` : 'Repository';
  }

  private static detectLanguageFromFiles(files: string[]): string {
    if (files.some(file => file.endsWith('.rs'))) return 'Rust';
    if (files.some(file => file.endsWith('.go'))) return 'Go';
    if (files.some(file => file.endsWith('.py'))) return 'Python';
    if (files.some(file => file.endsWith('.ts') || file.endsWith('.tsx'))) return 'TypeScript';
    if (files.some(file => file.endsWith('.js') || file.endsWith('.jsx'))) return 'JavaScript';
    return 'Unknown';
  }

  private static detectFrameworkFromFiles(files: string[]): string | undefined {
    if (files.some(file => file.startsWith('packages/') && file.endsWith('.ts'))) return 'Monorepo';
    if (files.some(file => file.includes('/app/') && file.endsWith('.tsx'))) return 'Next.js';
    if (files.some(file => file.includes('/components/') && file.endsWith('.tsx'))) return 'React';
    return undefined;
  }

  private static detectPackageManagerFromFiles(files: string[]): string {
    if (files.includes('pnpm-lock.yaml')) return 'pnpm';
    if (files.includes('yarn.lock')) return 'yarn';
    if (files.includes('Cargo.lock')) return 'cargo';
    if (files.includes('go.mod')) return 'go';
    return 'npm';
  }

  private static detectRemoteFileType(filePath: string): string {
    const fileName = path.basename(filePath).toLowerCase();
    if (fileName.includes('.test.') || fileName.includes('.spec.')) return 'test';
    if (fileName.endsWith('.proto')) return 'schema';
    if (fileName === 'readme.md' || filePath.toLowerCase().includes('/readme.md')) return 'documentation';
    if (fileName.includes('config')) return 'configuration';
    if (fileName.includes('service') || fileName.includes('api')) return 'service';
    if (fileName.includes('util') || fileName.includes('helper')) return 'utility';
    if (fileName.includes('component')) return 'component';
    if (filePath.startsWith('tools/') || filePath.includes('/cli/')) return 'tool';
    return 'source';
  }

  private static inferStaticDirectoryPurpose(dirName: string): string {
    const purposeMap: Record<string, string> = {
      src: 'Source code',
      lib: 'Library code',
      packages: 'Packages/modules',
      crates: 'Rust crates',
      tools: 'Command-line tools',
      apps: 'Applications',
      test: 'Tests',
      tests: 'Tests',
      docs: 'Documentation',
      examples: 'Examples',
      api: 'API endpoints',
      components: 'UI components',
      scripts: 'Automation scripts',
    };

    return purposeMap[dirName.toLowerCase()] || 'General purpose';
  }
}
