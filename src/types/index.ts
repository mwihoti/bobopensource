/**
 * Core types and interfaces for ContributorOS
 */

export interface RepositoryInfo {
  path: string;
  name: string;
  source: 'local' | 'remote';
  slug?: string;
  type: string;
  overview?: string;
  highlights?: string[];
  defaultBranch?: string;
  structure: ProjectStructure;
  patterns: DetectedPattern[];
  dependencies: DependencyInfo;
  techStack: TechStack;
  conventions: CodeConvention[];
}

export interface ProjectStructure {
  rootFiles: string[];
  directories: DirectoryInfo[];
  keyComponents: ComponentInfo[];
  entryPoints: string[];
}

export interface DirectoryInfo {
  path: string;
  fileCount: number;
  purpose: string;
  importance: 'high' | 'medium' | 'low';
}

export interface ComponentInfo {
  path: string;
  type: string;
  dependencies: string[];
  exports: string[];
}

export interface FileRecommendation {
  path: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ProjectActionGuide {
  title: string;
  actions: string[];
}

export interface StepResource {
  title: string;
  type: 'command' | 'file_excerpt' | 'code' | 'warning' | 'diff';
  language?: string;
  path?: string;
  content: string;
  description?: string;
  confidence?: number;
  reason?: string;
}

export interface EvidenceItem {
  label: string;
  detail: string;
}

export interface RiskSummary {
  level: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
}

export interface PrDraft {
  title: string;
  summary: string[];
  tests: string[];
}

export interface DetectedPattern {
  name: string;
  description: string;
  examples: string[];
  confidence: number;
}

export interface DependencyInfo {
  production: Record<string, string>;
  development: Record<string, string>;
  peerDependencies: Record<string, string>;
}

export interface TechStack {
  language: string;
  framework?: string;
  buildTool?: string;
  testFramework?: string;
  packageManager: string;
}

export interface CodeConvention {
  category: string;
  rule: string;
  examples: string[];
}

export interface IssueInfo {
  url: string;
  owner: string;
  repo: string;
  number: number;
  title: string;
  description: string;
  labels: string[];
  state?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
  source: 'github-api' | 'mock';
  discussionHighlights?: string[];
  type: IssueType;
  complexity: Complexity;
  affectedComponents: string[];
  requirements: string[];
  acceptanceCriteria: string[];
  relatedIssues: number[];
}

export type IssueType = 'bug' | 'feature' | 'enhancement' | 'documentation' | 'refactor';
export type Complexity = 'low' | 'medium' | 'high' | 'critical';

export interface DependencyMap {
  nodes: DependencyNode[];
  relations: DependencyRelation[];
  metrics: DependencyMetrics;
}

export interface DependencyMetrics {
  totalNodes: number;
  totalRelations: number;
  averageComplexity: number;
  highImpactNodes: number;
  circularDependencies: number;
}

export interface DependencyNode {
  id: string;
  path: string;
  type: string;
  dependencies: string[];
  dependents: string[];
  exports: string[];
  complexity: number;
  changeImpact: 'low' | 'medium' | 'high' | 'critical';
}

export interface DependencyRelation {
  from: string;
  to: string;
  type: string;
  strength: 'weak' | 'moderate' | 'strong';
}

export interface ImportInfo {
  source: string;
  items: string[];
  type: 'default' | 'named' | 'namespace';
}

export interface ExportInfo {
  name: string;
  type: 'default' | 'named';
  kind: 'function' | 'class' | 'variable' | 'type';
}

export interface ImplementationPlan {
  issue: IssueInfo;
  steps: ImplementationStep[];
  testStrategy: TestStrategy;
  risks: RiskAssessment[];
  estimatedHours: number;
  reviewPoints: string[];
  prerequisites: string[];
  rollbackStrategy: string[];
  warnings: string[];
  openQuestions: string[];
  projectOverview: string[];
  projectActionGuide: ProjectActionGuide[];
  evidence: EvidenceItem[];
  riskSummary: RiskSummary;
  prDraft: PrDraft;
  recommendedStartingPoints: FileRecommendation[];
  suggestedCodeChanges: string[];
}

export interface ImplementationStep {
  number: number;
  title: string;
  description: string;
  actions: string[];
  files: string[];
  estimatedMinutes: number;
  dependencies: number[];
  validationCriteria: string[];
  resources?: StepResource[];
  pitfalls?: string[];
  codeExamples?: string[];
  notes?: string[];
}

export interface TestStrategy {
  unitTests: string[];
  integrationTests: string[];
  e2eTests: string[];
  coverageTarget: number;
  criticalPaths: string[];
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  mitigation: string[];
}

export interface AnalysisConfig {
  depth?: 'quick' | 'standard' | 'deep';
  ignorePatterns: string[];
  focusAreas?: string[];
  maxFileSize: number;
  includeTests: boolean;
}

export interface OutputConfig {
  format: 'json' | 'markdown' | 'text';
  verbose: boolean;
  outputPath?: string;
}

export interface ContributorConfig {
  analysis: AnalysisConfig;
  output: OutputConfig;
  github?: {
    token?: string;
  };
}

export interface AnalysisResult {
  repository?: RepositoryInfo;
  issue?: IssueInfo;
  dependencyMap?: DependencyMap;
  implementationPlan?: ImplementationPlan;
  timestamp: Date;
}
