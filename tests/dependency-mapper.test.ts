import { DependencyMapper } from '../src/analyzers/dependency-mapper';
import { RepositoryInfo, ComponentInfo } from '../src/types';

describe('DependencyMapper', () => {
  let mockRepoInfo: RepositoryInfo;
  let mapper: DependencyMapper;

  beforeEach(() => {
    mockRepoInfo = {
      path: '/test/repo',
      name: 'test-repo',
      type: 'React Application',
      structure: {
        rootFiles: ['package.json', 'tsconfig.json'],
        directories: [],
        keyComponents: [
          {
            path: 'src/app.ts',
            type: 'entry',
            dependencies: ['src/utils.ts', 'src/config.ts'],
            exports: ['App'],
          },
          {
            path: 'src/utils.ts',
            type: 'utility',
            dependencies: [],
            exports: ['helper1', 'helper2'],
          },
          {
            path: 'src/config.ts',
            type: 'config',
            dependencies: ['src/utils.ts'],
            exports: ['config'],
          },
        ],
        entryPoints: ['src/app.ts'],
      },
      patterns: [],
      dependencies: {
        production: {},
        development: {},
        peerDependencies: {},
      },
      techStack: {
        language: 'TypeScript',
        packageManager: 'npm',
      },
      conventions: [],
    };

    mapper = new DependencyMapper(mockRepoInfo);
  });

  describe('buildDependencyMap', () => {
    it('should build dependency map with correct nodes', async () => {
      const map = await mapper.buildDependencyMap();

      expect(map.nodes.length).toBe(3);
      expect(map.nodes.find(n => n.path === 'src/app.ts')).toBeDefined();
      expect(map.nodes.find(n => n.path === 'src/utils.ts')).toBeDefined();
      expect(map.nodes.find(n => n.path === 'src/config.ts')).toBeDefined();
    });

    it('should calculate correct metrics', async () => {
      const map = await mapper.buildDependencyMap();

      expect(map.metrics.totalNodes).toBe(3);
      expect(map.metrics.totalRelations).toBeGreaterThan(0);
      expect(map.metrics.averageComplexity).toBeGreaterThan(0);
    });

    it('should identify dependents correctly', async () => {
      const map = await mapper.buildDependencyMap();

      const utilsNode = map.nodes.find(n => n.path === 'src/utils.ts');
      expect(utilsNode?.dependents.length).toBeGreaterThan(0);
    });
  });

  describe('findAffectedFiles', () => {
    it('should find all files affected by changes', async () => {
      await mapper.buildDependencyMap();

      const affected = mapper.findAffectedFiles('src/utils.ts');

      expect(affected).toContain('src/app.ts');
      expect(affected).toContain('src/config.ts');
    });

    it('should return empty array for non-existent file', async () => {
      await mapper.buildDependencyMap();

      const affected = mapper.findAffectedFiles('non-existent.ts');

      expect(affected).toEqual([]);
    });
  });

  describe('findAllDependencies', () => {
    it('should find all dependencies recursively', async () => {
      await mapper.buildDependencyMap();

      const deps = mapper.findAllDependencies('src/app.ts');

      expect(deps.length).toBeGreaterThan(0);
    });

    it('should return empty array for file with no dependencies', async () => {
      await mapper.buildDependencyMap();

      const deps = mapper.findAllDependencies('src/utils.ts');

      expect(deps).toEqual([]);
    });
  });

  describe('suggestImplementationOrder', () => {
    it('should order files by dependencies', async () => {
      await mapper.buildDependencyMap();

      const files = ['src/app.ts', 'src/utils.ts', 'src/config.ts'];
      const ordered = mapper.suggestImplementationOrder(files);

      // utils should come before app and config
      const utilsIndex = ordered.indexOf('src/utils.ts');
      const appIndex = ordered.indexOf('src/app.ts');
      const configIndex = ordered.indexOf('src/config.ts');

      expect(utilsIndex).toBeLessThan(appIndex);
      expect(utilsIndex).toBeLessThan(configIndex);
    });
  });

  describe('generateDotGraph', () => {
    it('should generate valid DOT format', async () => {
      await mapper.buildDependencyMap();

      const graph = mapper.generateDotGraph();

      expect(graph).toContain('digraph Dependencies');
      expect(graph).toContain('rankdir=LR');
      expect(graph).toContain('->');
    });

    it('should include only specified files when provided', async () => {
      await mapper.buildDependencyMap();

      const files = ['src/app.ts', 'src/utils.ts'];
      const graph = mapper.generateDotGraph(files);

      expect(graph).toContain('src/app.ts');
      expect(graph).toContain('src/utils.ts');
    });
  });

  describe('generateReport', () => {
    it('should generate comprehensive report', async () => {
      const map = await mapper.buildDependencyMap();
      const report = mapper.generateReport(map);

      expect(report).toContain('# Dependency Analysis Report');
      expect(report).toContain('## Overview');
      expect(report).toContain('Total Components:');
      expect(report).toContain('Total Dependencies:');
    });
  });
});
