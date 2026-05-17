/**
 * Basic usage examples for Bob Open Source
 */

import { RepositoryAnalyzer } from '../src/analyzers/repository';
import { IssueAnalyzer } from '../src/analyzers/issue';
import { DependencyMapper } from '../src/analyzers/dependency-mapper';
import { ImplementationPlanner } from '../src/analyzers/implementation-planner';
import { AnalysisConfig } from '../src/types';

/**
 * Example 1: Analyze a repository
 */
async function analyzeRepository() {
  console.log('=== Example 1: Repository Analysis ===\n');

  const config: AnalysisConfig = {
    ignorePatterns: ['node_modules', 'dist', 'build'],
    maxFileSize: 1024 * 1024,
    includeTests: true,
  };

  const analyzer = new RepositoryAnalyzer(process.cwd(), config);
  const repoInfo = await analyzer.analyze();

  console.log(`Repository: ${repoInfo.name}`);
  console.log(`Type: ${repoInfo.type}`);
  console.log(`Language: ${repoInfo.techStack.language}`);
  console.log(`Framework: ${repoInfo.techStack.framework || 'None'}`);
  console.log(`Components: ${repoInfo.structure.keyComponents.length}`);
  console.log(`Directories: ${repoInfo.structure.directories.length}`);
}

/**
 * Example 2: Analyze a GitHub issue
 */
async function analyzeIssue() {
  console.log('\n=== Example 2: Issue Analysis ===\n');

  const issueUrl = 'https://github.com/owner/repo/issues/123';
  
  const analyzer = new IssueAnalyzer();
  const issueInfo = await analyzer.analyzeIssue(issueUrl);

  console.log(`Issue #${issueInfo.number}: ${issueInfo.title}`);
  console.log(`Type: ${issueInfo.type}`);
  console.log(`Complexity: ${issueInfo.complexity}`);
  console.log(`Requirements: ${issueInfo.requirements.length}`);
  console.log(`Acceptance Criteria: ${issueInfo.acceptanceCriteria.length}`);
  
  console.log('\n' + analyzer.generateSummary(issueInfo));
}

/**
 * Example 3: Build dependency map
 */
async function buildDependencyMap() {
  console.log('\n=== Example 3: Dependency Mapping ===\n');

  const config: AnalysisConfig = {
    ignorePatterns: ['node_modules', 'dist', 'build'],
    maxFileSize: 1024 * 1024,
    includeTests: true,
  };

  const repoAnalyzer = new RepositoryAnalyzer(process.cwd(), config);
  const repoInfo = await repoAnalyzer.analyze();

  const dependencyMapper = new DependencyMapper(repoInfo);
  const dependencyMap = await dependencyMapper.buildDependencyMap();

  console.log(`Total Nodes: ${dependencyMap.metrics.totalNodes}`);
  console.log(`Total Relations: ${dependencyMap.metrics.totalRelations}`);
  console.log(`Average Complexity: ${dependencyMap.metrics.averageComplexity}`);
  console.log(`High Impact Nodes: ${dependencyMap.metrics.highImpactNodes}`);
  console.log(`Circular Dependencies: ${dependencyMap.metrics.circularDependencies}`);

  console.log('\n' + dependencyMapper.generateReport(dependencyMap));
}

/**
 * Example 4: Generate implementation plan
 */
async function generateImplementationPlan() {
  console.log('\n=== Example 4: Implementation Plan ===\n');

  const config: AnalysisConfig = {
    ignorePatterns: ['node_modules', 'dist', 'build'],
    maxFileSize: 1024 * 1024,
    includeTests: true,
  };

  // Analyze repository
  const repoAnalyzer = new RepositoryAnalyzer(process.cwd(), config);
  const repoInfo = await repoAnalyzer.analyze();

  // Analyze issue
  const issueUrl = 'https://github.com/owner/repo/issues/123';
  const issueAnalyzer = new IssueAnalyzer(repoInfo);
  const issueInfo = await issueAnalyzer.analyzeIssue(issueUrl);

  // Build dependency map
  const dependencyMapper = new DependencyMapper(repoInfo);
  const dependencyMap = await dependencyMapper.buildDependencyMap();

  // Generate plan
  const planner = new ImplementationPlanner(repoInfo, dependencyMapper);
  const plan = await planner.generatePlan(issueInfo, dependencyMap);

  console.log(`Steps: ${plan.steps.length}`);
  console.log(`Estimated Hours: ${plan.estimatedHours}`);
  console.log(`Risks: ${plan.risks.length}`);
  console.log(`Review Points: ${plan.reviewPoints.length}`);

  console.log('\n' + planner.generateSummary(plan));
}

/**
 * Example 5: Find affected files
 */
async function findAffectedFiles() {
  console.log('\n=== Example 5: Find Affected Files ===\n');

  const config: AnalysisConfig = {
    ignorePatterns: ['node_modules', 'dist', 'build'],
    maxFileSize: 1024 * 1024,
    includeTests: true,
  };

  const repoAnalyzer = new RepositoryAnalyzer(process.cwd(), config);
  const repoInfo = await repoAnalyzer.analyze();

  const dependencyMapper = new DependencyMapper(repoInfo);
  await dependencyMapper.buildDependencyMap();

  const targetFile = 'src/utils/helpers.ts';
  const affected = dependencyMapper.findAffectedFiles(targetFile);

  console.log(`Files affected by changes to ${targetFile}:`);
  affected.forEach(file => console.log(`  - ${file}`));
}

/**
 * Example 6: Generate dependency graph
 */
async function generateDependencyGraph() {
  console.log('\n=== Example 6: Dependency Graph ===\n');

  const config: AnalysisConfig = {
    ignorePatterns: ['node_modules', 'dist', 'build'],
    maxFileSize: 1024 * 1024,
    includeTests: true,
  };

  const repoAnalyzer = new RepositoryAnalyzer(process.cwd(), config);
  const repoInfo = await repoAnalyzer.analyze();

  const dependencyMapper = new DependencyMapper(repoInfo);
  await dependencyMapper.buildDependencyMap();

  const files = ['src/app.ts', 'src/utils.ts'];
  const graph = dependencyMapper.generateDotGraph(files);

  console.log('DOT Graph:');
  console.log(graph);
  console.log('\nYou can visualize this with Graphviz:');
  console.log('  dot -Tpng graph.dot -o graph.png');
}

// Run examples
async function main() {
  try {
    await analyzeRepository();
    await analyzeIssue();
    await buildDependencyMap();
    await generateImplementationPlan();
    await findAffectedFiles();
    await generateDependencyGraph();
  } catch (error) {
    console.error('Error:', error);
  }
}

// Uncomment to run
// main();
