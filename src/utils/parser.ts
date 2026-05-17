import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  lines: number;
  content?: string;
}

export class FileParser {
  /**
   * Read file content safely
   */
  static readFile(filePath: string): string {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error}`);
    }
  }

  /**
   * Get file information
   */
  static getFileInfo(filePath: string, includeContent: boolean = false): FileInfo {
    const stats = fs.statSync(filePath);
    const content = includeContent ? this.readFile(filePath) : undefined;
    
    return {
      path: filePath,
      name: path.basename(filePath),
      extension: path.extname(filePath),
      size: stats.size,
      lines: content ? content.split('\n').length : 0,
      content,
    };
  }

  /**
   * Find files matching patterns
   */
  static async findFiles(
    baseDir: string,
    patterns: string[],
    ignorePatterns: string[] = []
  ): Promise<string[]> {
    const allFiles: string[] = [];
    const normalizedIgnorePatterns = this.normalizeIgnorePatterns(ignorePatterns);
    
    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: baseDir,
        absolute: true,
        ignore: normalizedIgnorePatterns,
        nodir: true,
      });
      allFiles.push(...files);
    }
    
    return [...new Set(allFiles)];
  }

  /**
   * Extract imports from JavaScript/TypeScript file
   */
  static extractImports(content: string): string[] {
    const imports: string[] = [];
    
    // Match ES6 imports
    const es6ImportRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = es6ImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    // Match require statements
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return [...new Set(imports)];
  }

  /**
   * Extract exports from JavaScript/TypeScript file
   */
  static extractExports(content: string): string[] {
    const exports: string[] = [];
    
    // Match named exports
    const namedExportRegex = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
    let match;
    
    while ((match = namedExportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    
    // Match export { ... }
    const exportBlockRegex = /export\s+\{([^}]+)\}/g;
    while ((match = exportBlockRegex.exec(content)) !== null) {
      const items = match[1].split(',').map(item => item.trim().split(/\s+as\s+/)[0]);
      exports.push(...items);
    }
    
    // Match default export
    if (/export\s+default/.test(content)) {
      exports.push('default');
    }
    
    return [...new Set(exports)];
  }

  /**
   * Detect file type/purpose
   */
  static detectFileType(filePath: string, content: string): string {
    const fileName = path.basename(filePath).toLowerCase();
    const ext = path.extname(filePath);
    
    // Configuration files
    if (fileName.includes('config') || fileName.includes('.rc')) {
      return 'configuration';
    }
    
    // Test files
    if (fileName.includes('.test.') || fileName.includes('.spec.') || filePath.includes('__tests__')) {
      return 'test';
    }
    
    // Type definition files
    if (ext === '.d.ts') {
      return 'type-definition';
    }
    
    // Component files (React, Vue, etc.)
    if (content.includes('React.Component') || content.includes('export default function') || 
        content.includes('export function') && (ext === '.jsx' || ext === '.tsx')) {
      return 'component';
    }
    
    // Utility/helper files
    if (fileName.includes('util') || fileName.includes('helper')) {
      return 'utility';
    }
    
    // Hook files (React)
    if (fileName.startsWith('use') && (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx')) {
      return 'hook';
    }
    
    // Service files
    if (fileName.includes('service') || fileName.includes('api')) {
      return 'service';
    }
    
    // Model/Schema files
    if (fileName.includes('model') || fileName.includes('schema')) {
      return 'model';
    }
    
    return 'source';
  }

  /**
   * Count lines of code (excluding comments and blank lines)
   */
  static countLOC(content: string): { total: number; code: number; comments: number; blank: number } {
    const lines = content.split('\n');
    let code = 0;
    let comments = 0;
    let blank = 0;
    let inBlockComment = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed === '') {
        blank++;
      } else if (inBlockComment) {
        comments++;
        if (trimmed.includes('*/')) {
          inBlockComment = false;
        }
      } else if (trimmed.startsWith('//')) {
        comments++;
      } else if (trimmed.startsWith('/*')) {
        comments++;
        if (!trimmed.includes('*/')) {
          inBlockComment = true;
        }
      } else {
        code++;
      }
    }
    
    return {
      total: lines.length,
      code,
      comments,
      blank,
    };
  }

  /**
   * Extract functions from code
   */
  static extractFunctions(content: string): string[] {
    const functions: string[] = [];
    
    // Match function declarations
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      functions.push(match[1]);
    }
    
    // Match arrow functions assigned to variables
    const arrowFunctionRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g;
    while ((match = arrowFunctionRegex.exec(content)) !== null) {
      functions.push(match[1]);
    }
    
    return functions;
  }

  /**
   * Extract classes from code
   */
  static extractClasses(content: string): string[] {
    const classes: string[] = [];
    const classRegex = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g;
    let match;
    
    while ((match = classRegex.exec(content)) !== null) {
      classes.push(match[1]);
    }
    
    return classes;
  }

  /**
   * Check if file is a configuration file
   */
  static isConfigFile(filePath: string): boolean {
    const fileName = path.basename(filePath).toLowerCase();
    const configPatterns = [
      'package.json',
      'tsconfig.json',
      'webpack.config',
      'babel.config',
      'jest.config',
      'eslint',
      'prettier',
      '.env',
      'dockerfile',
      'docker-compose',
    ];
    
    return configPatterns.some(pattern => fileName.includes(pattern));
  }

  /**
   * Get relative path from base directory
   */
  static getRelativePath(filePath: string, baseDir: string): string {
    return path.relative(baseDir, filePath);
  }

  private static normalizeIgnorePatterns(ignorePatterns: string[]): string[] {
    const normalized = new Set<string>();

    for (const pattern of ignorePatterns) {
      const trimmed = pattern.trim();
      if (!trimmed) {
        continue;
      }

      normalized.add(trimmed);
      normalized.add(`**/${trimmed}`);
      normalized.add(`**/${trimmed}/**`);
    }

    return Array.from(normalized);
  }
}
