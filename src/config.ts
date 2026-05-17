import * as fs from 'fs';
import * as path from 'path';
import { logger } from './utils/logger';
import { AnalysisConfig } from './types';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: AnalysisConfig = {
  ignorePatterns: [
    'node_modules',
    'dist',
    'build',
    '.git',
    'coverage',
    '.next',
    '.nuxt',
    '__pycache__',
    '*.pyc',
    '.DS_Store',
  ],
  maxFileSize: 1024 * 1024, // 1MB
  includeTests: true,
};

/**
 * Configuration file names to search for
 */
const CONFIG_FILES = [
  '.bobopensourcerc',
  '.bobopensourcerc.json',
  '.bobopensourcerc.js',
  'bobopensource.config.js',
  'bobopensource.config.json',
];

/**
 * Configuration manager
 */
export class ConfigManager {
  private config: AnalysisConfig;
  private configPath?: string;

  constructor(customConfig?: Partial<AnalysisConfig>) {
    this.config = { ...DEFAULT_CONFIG };
    
    if (customConfig) {
      this.mergeConfig(customConfig);
    }
  }

  /**
   * Load configuration from file
   */
  static async loadFromFile(repoPath: string): Promise<ConfigManager> {
    const configManager = new ConfigManager();
    
    // Search for config file
    for (const configFile of CONFIG_FILES) {
      const configPath = path.join(repoPath, configFile);
      
      if (fs.existsSync(configPath)) {
        try {
          const loadedConfig = await configManager.loadConfigFile(configPath);
          configManager.mergeConfig(loadedConfig);
          configManager.configPath = configPath;
          logger.info(`Configuration loaded from: ${configFile}`);
          break;
        } catch (error) {
          logger.warn(`Failed to load config from ${configFile}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    return configManager;
  }

  /**
   * Load configuration file
   */
  private async loadConfigFile(configPath: string): Promise<Partial<AnalysisConfig>> {
    const ext = path.extname(configPath);

    if (ext === '.json' || configPath.endsWith('rc')) {
      // JSON configuration
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } else if (ext === '.js') {
      // JavaScript configuration
      const configModule = require(configPath);
      return configModule.default || configModule;
    }

    throw new Error(`Unsupported config file format: ${ext}`);
  }

  /**
   * Merge configuration
   */
  private mergeConfig(customConfig: Partial<AnalysisConfig>): void {
    if (customConfig.ignorePatterns) {
      // Merge ignore patterns (don't replace)
      this.config.ignorePatterns = [
        ...new Set([...this.config.ignorePatterns, ...customConfig.ignorePatterns]),
      ];
    }

    if (customConfig.maxFileSize !== undefined) {
      this.config.maxFileSize = customConfig.maxFileSize;
    }

    if (customConfig.includeTests !== undefined) {
      this.config.includeTests = customConfig.includeTests;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AnalysisConfig {
    return { ...this.config };
  }

  /**
   * Get configuration path
   */
  getConfigPath(): string | undefined {
    return this.configPath;
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate maxFileSize
    if (this.config.maxFileSize <= 0) {
      errors.push('maxFileSize must be greater than 0');
    }

    // Validate ignorePatterns
    if (!Array.isArray(this.config.ignorePatterns)) {
      errors.push('ignorePatterns must be an array');
    }

    // Validate includeTests
    if (typeof this.config.includeTests !== 'boolean') {
      errors.push('includeTests must be a boolean');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a sample configuration file
   */
  static createSampleConfig(outputPath: string): void {
    const sampleConfig = {
      // Patterns to ignore during analysis
      ignorePatterns: [
        'node_modules',
        'dist',
        'build',
        '.git',
        'coverage',
        // Add your custom patterns here
      ],

      // Maximum file size to analyze (in bytes)
      // Default: 1MB
      maxFileSize: 1024 * 1024,

      // Whether to include test files in analysis
      includeTests: true,

      // GitHub API configuration (optional)
      github: {
        // Personal access token for GitHub API
        // token: 'your-github-token',
        
        // API base URL (for GitHub Enterprise)
        // baseUrl: 'https://api.github.com',
      },

      // Analysis preferences
      analysis: {
        // Minimum complexity threshold for reporting
        // minComplexity: 5,
        
        // Maximum depth for dependency analysis
        // maxDepth: 5,
        
        // Enable/disable specific analyzers
        // enablePatternDetection: true,
        // enableDependencyAnalysis: true,
      },

      // Output preferences
      output: {
        // Default output format: 'markdown' | 'json' | 'html'
        // format: 'markdown',
        
        // Include detailed metrics in output
        // includeMetrics: true,
        
        // Include dependency graphs
        // includeGraphs: false,
      },
    };

    const content = JSON.stringify(sampleConfig, null, 2);
    fs.writeFileSync(outputPath, content, 'utf-8');
    logger.success(`Sample configuration created: ${outputPath}`);
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): AnalysisConfig {
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AnalysisConfig>): void {
    this.mergeConfig(updates);
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.configPath = undefined;
  }

  /**
   * Save configuration to file
   */
  saveToFile(outputPath: string): void {
    const ext = path.extname(outputPath);
    
    if (ext === '.json' || outputPath.endsWith('rc')) {
      const content = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(outputPath, content, 'utf-8');
      logger.success(`Configuration saved to: ${outputPath}`);
    } else {
      throw new Error(`Unsupported config file format: ${ext}. Use .json or rc extension.`);
    }
  }

  /**
   * Display current configuration
   */
  display(): void {
    console.log('\n=== Current Configuration ===');
    console.log(JSON.stringify(this.config, null, 2));
    
    if (this.configPath) {
      console.log(`\nLoaded from: ${this.configPath}`);
    } else {
      console.log('\nUsing default configuration');
    }
  }
}

/**
 * Load configuration for a repository
 */
export async function loadConfig(
  repoPath: string,
  customConfig?: Partial<AnalysisConfig>
): Promise<AnalysisConfig> {
  const configManager = await ConfigManager.loadFromFile(repoPath);
  
  if (customConfig) {
    configManager.updateConfig(customConfig);
  }

  const validation = configManager.validate();
  if (!validation.valid) {
    logger.warn('Configuration validation failed:');
    validation.errors.forEach(error => logger.warn(`  - ${error}`));
    logger.warn('Using default values for invalid settings');
  }

  return configManager.getConfig();
}

/**
 * Create a sample configuration file
 */
export function createSampleConfig(outputPath: string = '.bobopensourcerc.json'): void {
  ConfigManager.createSampleConfig(outputPath);
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): AnalysisConfig {
  return ConfigManager.getDefaultConfig();
}
