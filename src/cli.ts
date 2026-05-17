#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from './utils/logger';
import { RepositoryAnalyzer } from './analyzers/repository';
import { IssueAnalyzer } from './analyzers/issue';
import { DependencyMapper } from './analyzers/dependency-mapper';
import { ImplementationPlanner } from './analyzers/implementation-planner';
import { AnalysisConfig } from './types';
import { GitUtils } from './utils/git';

const program = new Command();

async function validateIssueRepoMatchesLocalRepo(issueUrl: string, repoPath: string): Promise<void> {
  const issueRepo = GitUtils.parseGitHubUrl(issueUrl);
  if (!issueRepo) {
    return;
  }

  const gitUtils = new GitUtils(repoPath);
  const localRepo = await gitUtils.getGitHubRemoteSlug();
  if (!localRepo) {
    logger.warn('Could not determine local repository remote. Continuing without repository/issue match validation.');
    return;
  }

  const sameRepo =
    localRepo.owner.toLowerCase() === issueRepo.owner.toLowerCase() &&
    localRepo.repo.toLowerCase() === issueRepo.repo.toLowerCase();

  if (!sameRepo) {
    throw new Error(
      `Issue belongs to ${issueRepo.owner}/${issueRepo.repo}, but local repository remote is ${localRepo.owner}/${localRepo.repo}. Run the command from a checkout of the target repository or pass --repo to the matching local path.`
    );
  }
}

program
  .name('bobopensource')
  .description('AI-powered GitHub issue analyzer and implementation planner')
  .version('1.0.0');

/**
 * Analyze command - Full analysis of issue and repository
 */
program
  .command('analyze')
  .description('Analyze a GitHub issue and generate implementation plan')
  .argument('<issue-url>', 'GitHub issue URL')
  .option('-r, --repo <path>', 'Local repository path for deep analysis')
  .option('-o, --output <file>', 'Output file for the plan (markdown format)')
  .option('--json', 'Output in JSON format')
  .option('--no-deps', 'Skip dependency analysis')
  .option('--no-plan', 'Skip implementation plan generation')
  .action(async (issueUrl: string, options) => {
    try {
      logger.info('Starting analysis...');

      // Configuration
      const config: AnalysisConfig = {
        ignorePatterns: ['node_modules', 'dist', 'build', '.git'],
        maxFileSize: 1024 * 1024, // 1MB
        includeTests: true,
      };

      const issueRepo = GitUtils.parseGitHubUrl(issueUrl);
      if (!issueRepo) {
        throw new Error('Invalid GitHub issue URL');
      }

      // Step 1: Analyze repository
      logger.info('Analyzing repository structure...');
      let repoInfo;
      if (options.repo) {
        const repoPath = path.resolve(options.repo);
        if (!fs.existsSync(repoPath)) {
          logger.error(`Repository path does not exist: ${repoPath}`);
          process.exit(1);
        }

        await validateIssueRepoMatchesLocalRepo(issueUrl, repoPath);
        const repoAnalyzer = new RepositoryAnalyzer(repoPath, config);
        repoInfo = await repoAnalyzer.analyze();
      } else {
        repoInfo = await RepositoryAnalyzer.analyzeRemote(issueRepo.owner, issueRepo.repo, config);
      }
      logger.success(`Repository analyzed: ${repoInfo.name} (${repoInfo.type})`);

      // Step 2: Analyze issue
      logger.info('Analyzing GitHub issue...');
      const issueAnalyzer = new IssueAnalyzer(repoInfo);
      const issueInfo = await issueAnalyzer.analyzeIssue(issueUrl);
      logger.success(`Issue analyzed: #${issueInfo.number} - ${issueInfo.title}`);

      // Display issue summary
      console.log('\n' + issueAnalyzer.generateSummary(issueInfo));

      // Step 3: Build dependency map (if not disabled)
      let dependencyMap;
      let dependencyMapper;
      
      if (options.deps !== false) {
        logger.info('Building dependency map...');
        dependencyMapper = new DependencyMapper(repoInfo);
        dependencyMap = await dependencyMapper.buildDependencyMap();
        logger.success(`Dependency map built: ${dependencyMap.metrics.totalNodes} components, ${dependencyMap.metrics.totalRelations} relations`);
        
        // Display dependency report
        console.log('\n' + dependencyMapper.generateReport(dependencyMap));
      }

      // Step 4: Generate implementation plan (if not disabled)
      if (options.plan !== false && dependencyMap && dependencyMapper) {
        logger.info('Generating implementation plan...');
        const planner = new ImplementationPlanner(repoInfo, dependencyMapper);
        const plan = await planner.generatePlan(issueInfo, dependencyMap);
        logger.success(`Implementation plan generated: ${plan.steps.length} steps, ~${plan.estimatedHours} hours`);

        const planSummary = planner.generateSummary(plan);

        // Output plan
        if (options.output) {
          const outputPath = path.resolve(options.output);
          fs.writeFileSync(outputPath, planSummary, 'utf-8');
          logger.success(`Plan saved to: ${outputPath}`);
        } else if (options.json) {
          console.log(JSON.stringify(plan, null, 2));
        } else {
          console.log('\n' + planSummary);
        }
      }

      logger.success('Analysis complete!');
    } catch (error) {
      logger.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

/**
 * Repository command - Analyze repository only
 */
program
  .command('repo')
  .description('Analyze repository structure and dependencies')
  .option('-r, --repo <path>', 'Repository path (defaults to current directory)', process.cwd())
  .option('-o, --output <file>', 'Output file for the analysis')
  .option('--json', 'Output in JSON format')
  .option('--graph', 'Generate dependency graph (DOT format)')
  .action(async (options) => {
    try {
      const repoPath = path.resolve(options.repo);
      
      if (!fs.existsSync(repoPath)) {
        logger.error(`Repository path does not exist: ${repoPath}`);
        process.exit(1);
      }

      const config: AnalysisConfig = {
        ignorePatterns: ['node_modules', 'dist', 'build', '.git'],
        maxFileSize: 1024 * 1024,
        includeTests: true,
      };

      logger.info('Analyzing repository...');
      const analyzer = new RepositoryAnalyzer(repoPath, config);
      const repoInfo = await analyzer.analyze();

      logger.info('Building dependency map...');
      const dependencyMapper = new DependencyMapper(repoInfo);
      const dependencyMap = await dependencyMapper.buildDependencyMap();

      if (options.json) {
        const output = { repoInfo, dependencyMap };
        if (options.output) {
          fs.writeFileSync(options.output, JSON.stringify(output, null, 2));
          logger.success(`Analysis saved to: ${options.output}`);
        } else {
          console.log(JSON.stringify(output, null, 2));
        }
      } else if (options.graph) {
        const graph = dependencyMapper.generateDotGraph();
        if (options.output) {
          fs.writeFileSync(options.output, graph);
          logger.success(`Dependency graph saved to: ${options.output}`);
        } else {
          console.log(graph);
        }
      } else {
        const report = dependencyMapper.generateReport(dependencyMap);
        if (options.output) {
          fs.writeFileSync(options.output, report);
          logger.success(`Report saved to: ${options.output}`);
        } else {
          console.log(report);
        }
      }

      logger.success('Repository analysis complete!');
    } catch (error) {
      logger.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

/**
 * Issue command - Analyze issue only
 */
program
  .command('issue')
  .description('Analyze a GitHub issue')
  .argument('<issue-url>', 'GitHub issue URL')
  .option('-r, --repo <path>', 'Local repository path for context')
  .option('-o, --output <file>', 'Output file for the analysis')
  .option('--json', 'Output in JSON format')
  .action(async (issueUrl: string, options) => {
    try {
      let repoInfo;
      
      if (options.repo && fs.existsSync(options.repo)) {
        await validateIssueRepoMatchesLocalRepo(issueUrl, options.repo);

        const config: AnalysisConfig = {
          ignorePatterns: ['node_modules', 'dist', 'build', '.git'],
          maxFileSize: 1024 * 1024,
          includeTests: true,
        };
        
        logger.info('Analyzing repository for context...');
        const analyzer = new RepositoryAnalyzer(options.repo, config);
        repoInfo = await analyzer.analyze();
      }

      logger.info('Analyzing issue...');
      const issueAnalyzer = new IssueAnalyzer(repoInfo);
      const issueInfo = await issueAnalyzer.analyzeIssue(issueUrl);

      if (options.json) {
        const output = options.output;
        if (output) {
          fs.writeFileSync(output, JSON.stringify(issueInfo, null, 2));
          logger.success(`Issue analysis saved to: ${output}`);
        } else {
          console.log(JSON.stringify(issueInfo, null, 2));
        }
      } else {
        const summary = issueAnalyzer.generateSummary(issueInfo);
        if (options.output) {
          fs.writeFileSync(options.output, summary);
          logger.success(`Issue summary saved to: ${options.output}`);
        } else {
          console.log(summary);
        }
      }

      logger.success('Issue analysis complete!');
    } catch (error) {
      logger.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

/**
 * Plan command - Generate implementation plan for an issue
 */
program
  .command('plan')
  .description('Generate implementation plan for a GitHub issue')
  .argument('<issue-url>', 'GitHub issue URL')
  .option('-r, --repo <path>', 'Local repository path for deep analysis')
  .option('-o, --output <file>', 'Output file for the plan')
  .option('--json', 'Output in JSON format')
  .action(async (issueUrl: string, options) => {
    try {
      const config: AnalysisConfig = {
        ignorePatterns: ['node_modules', 'dist', 'build', '.git'],
        maxFileSize: 1024 * 1024,
        includeTests: true,
      };

      const issueRepo = GitUtils.parseGitHubUrl(issueUrl);
      if (!issueRepo) {
        throw new Error('Invalid GitHub issue URL');
      }

      // Analyze repository
      logger.info('Analyzing repository...');
      let repoInfo;
      if (options.repo) {
        const repoPath = path.resolve(options.repo);
        if (!fs.existsSync(repoPath)) {
          logger.error(`Repository path does not exist: ${repoPath}`);
          process.exit(1);
        }

        await validateIssueRepoMatchesLocalRepo(issueUrl, repoPath);
        const repoAnalyzer = new RepositoryAnalyzer(repoPath, config);
        repoInfo = await repoAnalyzer.analyze();
      } else {
        repoInfo = await RepositoryAnalyzer.analyzeRemote(issueRepo.owner, issueRepo.repo, config);
      }

      // Analyze issue
      logger.info('Analyzing issue...');
      const issueAnalyzer = new IssueAnalyzer(repoInfo);
      const issueInfo = await issueAnalyzer.analyzeIssue(issueUrl);

      // Build dependency map
      logger.info('Building dependency map...');
      const dependencyMapper = new DependencyMapper(repoInfo);
      const dependencyMap = await dependencyMapper.buildDependencyMap();

      // Generate plan
      logger.info('Generating implementation plan...');
      const planner = new ImplementationPlanner(repoInfo, dependencyMapper);
      const plan = await planner.generatePlan(issueInfo, dependencyMap);

      if (options.json) {
        const output = options.output;
        if (output) {
          fs.writeFileSync(output, JSON.stringify(plan, null, 2));
          logger.success(`Plan saved to: ${output}`);
        } else {
          console.log(JSON.stringify(plan, null, 2));
        }
      } else {
        const summary = planner.generateSummary(plan);
        if (options.output) {
          fs.writeFileSync(options.output, summary);
          logger.success(`Plan saved to: ${options.output}`);
        } else {
          console.log(summary);
        }
      }

      logger.success('Implementation plan generated!');
    } catch (error) {
      logger.error(`Plan generation failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

/**
 * Dependencies command - Analyze file dependencies
 */
program
  .command('deps')
  .description('Analyze dependencies for specific files')
  .argument('<files...>', 'Files to analyze')
  .option('-r, --repo <path>', 'Repository path (defaults to current directory)', process.cwd())
  .option('--affected', 'Show files affected by changes')
  .option('--graph', 'Generate dependency graph')
  .action(async (files: string[], options) => {
    try {
      const repoPath = path.resolve(options.repo);
      
      if (!fs.existsSync(repoPath)) {
        logger.error(`Repository path does not exist: ${repoPath}`);
        process.exit(1);
      }

      const config: AnalysisConfig = {
        ignorePatterns: ['node_modules', 'dist', 'build', '.git'],
        maxFileSize: 1024 * 1024,
        includeTests: true,
      };

      logger.info('Analyzing repository...');
      const repoAnalyzer = new RepositoryAnalyzer(repoPath, config);
      const repoInfo = await repoAnalyzer.analyze();

      logger.info('Building dependency map...');
      const dependencyMapper = new DependencyMapper(repoInfo);
      await dependencyMapper.buildDependencyMap();

      for (const file of files) {
        console.log(`\n=== ${file} ===`);
        
        if (options.affected) {
          const affected = dependencyMapper.findAffectedFiles(file);
          console.log('\nAffected files:');
          affected.forEach(f => console.log(`  - ${f}`));
        } else {
          const deps = dependencyMapper.findAllDependencies(file);
          console.log('\nDependencies:');
          deps.forEach(d => console.log(`  - ${d}`));
        }
      }

      if (options.graph) {
        console.log('\n=== Dependency Graph (DOT format) ===');
        console.log(dependencyMapper.generateDotGraph(files));
      }

      logger.success('Dependency analysis complete!');
    } catch (error) {
      logger.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
