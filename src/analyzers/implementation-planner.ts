import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';
import {
  IssueInfo,
  RepositoryInfo,
  DependencyMap,
  ImplementationPlan,
  ImplementationStep,
  TestStrategy,
  RiskAssessment,
  FileRecommendation,
  ProjectActionGuide,
  StepResource,
  EvidenceItem,
  RiskSummary,
  PrDraft,
} from '../types';
import { DependencyMapper } from './dependency-mapper';
import { GitHubClient } from '../utils/github';
import { CodeIntelligence } from '../utils/code-intelligence';

export class ImplementationPlanner {
  private repoInfo: RepositoryInfo;
  private dependencyMapper: DependencyMapper;
  private githubClient: GitHubClient;

  constructor(repoInfo: RepositoryInfo, dependencyMapper: DependencyMapper) {
    this.repoInfo = repoInfo;
    this.dependencyMapper = dependencyMapper;
    this.githubClient = new GitHubClient();
  }

  /**
   * Generate a complete implementation plan for an issue
   */
  async generatePlan(
    issue: IssueInfo,
    dependencyMap: DependencyMap
  ): Promise<ImplementationPlan> {
    logger.progress('Generating implementation plan');

    // Map issue dependencies
    const issueDeps = this.dependencyMapper.mapIssueDependencies(issue);

    // Generate implementation steps
    const steps = this.generateSteps(issue, issueDeps);

    // Create test strategy
    const testStrategy = this.createTestStrategy(issue, issueDeps);

    // Assess risks
    const risks = this.assessRisks(issue, issueDeps, dependencyMap);

    // Estimate effort
    const estimatedHours = this.estimateEffort(issue, steps, risks);

    // Suggest review points
    const reviewPoints = this.suggestReviewPoints(steps);
    const warnings = this.buildWarnings(issue, issueDeps);
    const openQuestions = this.identifyOpenQuestions(issue, issueDeps);
    const projectOverview = this.buildProjectOverview();
    const projectActionGuide = this.buildProjectActionGuide(issue);
    const recommendedStartingPoints = this.recommendStartingPoints(issue, issueDeps);
    const suggestedCodeChanges = this.suggestCodeChanges(issue, recommendedStartingPoints);
    const evidence = this.buildEvidence(recommendedStartingPoints);
    const riskSummary = this.buildRiskSummary(issue, risks, issueDeps);
    const prDraft = this.buildPrDraft(issue, recommendedStartingPoints);
    const enrichedSteps = await this.enrichSteps(steps, issue, issueDeps, recommendedStartingPoints);

    logger.success('Implementation plan generated');

    return {
      issue,
      steps: enrichedSteps,
      testStrategy,
      risks,
      estimatedHours,
      reviewPoints,
      prerequisites: this.identifyPrerequisites(issue),
      rollbackStrategy: this.createRollbackStrategy(issue, issueDeps),
      warnings,
      openQuestions,
      projectOverview,
      projectActionGuide,
      evidence,
      riskSummary,
      prDraft,
      recommendedStartingPoints,
      suggestedCodeChanges,
    };
  }

  /**
   * Generate implementation steps
   */
  private generateSteps(
    issue: IssueInfo,
    issueDeps: {
      directlyAffected: string[];
      indirectlyAffected: string[];
      requiredChanges: string[];
      testFiles: string[];
    }
  ): ImplementationStep[] {
    if (issueDeps.directlyAffected.length === 0) {
      return this.generateDiscoveryPlan(issue);
    }

    return this.generateConcretePlan(issue, issueDeps);
  }

  private generateDiscoveryPlan(issue: IssueInfo): ImplementationStep[] {
    const steps: ImplementationStep[] = [];
    const candidateFiles = this.getInitialInvestigationTargets(issue);
    const implementationCandidates = candidateFiles.filter(file => this.isImplementationCandidate(file));
    const contextCandidates = candidateFiles.filter(file => !this.isImplementationCandidate(file));
    const candidateTests = this.getCandidateTestTargets(implementationCandidates);

    steps.push({
      number: 1,
      title: 'Setup and Preparation',
      description: 'Review the issue, repository conventions, and any linked design context before writing code.',
      actions: [
        'Create a new feature branch from main/master',
        'Read the full issue body and any linked issues or design notes',
        'Inspect the target repository structure and existing tooling',
        'Confirm the local checkout matches the issue repository',
        ...([...(contextCandidates.slice(0, 2)), ...(implementationCandidates.slice(0, 2))].length > 0
          ? [`Start your repo walkthrough with these likely issue-related files: ${[...(contextCandidates.slice(0, 2)), ...(implementationCandidates.slice(0, 2))].join(', ')}.`]
          : []),
      ],
      files: [],
      estimatedMinutes: 20,
      dependencies: [],
      validationCriteria: [
        'Target repository is confirmed',
        'Linked context is reviewed',
        'The local environment is ready',
      ],
      pitfalls: [
        'Do not assume the first candidate file is the correct edit target until you confirm the code path.',
        'Do not start coding before checking linked issues or design discussion for hidden scope constraints.',
      ],
    });

    steps.push({
      number: 2,
      title: 'Define the First Narrow Milestone',
      description: 'Reduce the issue to one reviewable milestone instead of attempting the full roadmap at once.',
      actions: [
        'List candidate sub-problems or contract checks the issue suggests',
        'Choose the smallest deterministic slice that can ship first',
        'Mark later work such as profiling, offline analysis, or learned behavior as follow-up milestones',
        'Write down the explicit scope and non-goals for v1',
        ...(candidateFiles.length > 0
          ? [`Use the candidate files to define scope boundaries, for example protocol definitions in ${candidateFiles.filter(file => file.endsWith('.proto')).slice(0, 2).join(', ') || contextCandidates.slice(0, 2).join(', ') || candidateFiles.slice(0, 2).join(', ')} and implementation modules in ${implementationCandidates.slice(0, 2).join(', ') || candidateFiles.slice(0, 2).join(', ')}.`]
          : []),
      ],
      files: [],
      estimatedMinutes: 30,
      dependencies: [1],
      validationCriteria: [
        'A narrow v1 scope is documented',
        'Follow-up milestones are separated from the MVP',
        'The first milestone is reviewable on its own',
      ],
      pitfalls: [
        'Do not bundle archive, replay, profiling, and learned-pattern work into the first change unless the repo already supports it cleanly.',
      ],
    });

    steps.push({
      number: 3,
      title: 'Design the Core Engine Before Adapters',
      description: 'Keep the reusable rule or state engine separate from transport, storage, and reporting.',
      actions: [
        'Define a pure state machine or rule engine for the first milestone',
        'Keep transport input, archive input, and output reporting in thin adapters',
        'Decide what evidence each alert or finding must retain',
        'Prefer deterministic rule-based checks for v1 over learned patterns',
        ...(candidateFiles.length > 0
          ? [`If the repo already has adjacent tools or schemas, inspect them first: ${[...contextCandidates.slice(0, 2), ...implementationCandidates.slice(0, 1)].join(', ') || candidateFiles.slice(0, 3).join(', ')}.`]
          : []),
      ],
      files: [],
      estimatedMinutes: 45,
      dependencies: [2],
      validationCriteria: [
        'Core logic is isolated from IO concerns',
        'Future live and offline modes can reuse the same engine',
        'Evidence fields are explicit for every finding type',
      ],
      pitfalls: [
        'Do not let transport code or persistence concerns leak into the rule engine.',
      ],
    });

    steps.push({
      number: 4,
      title: 'Implement the MVP Slice',
      description: 'Ship the first milestone using existing repository conventions for logs, alerts, or outputs.',
      actions: [
        'Implement only the chosen v1 contract or behavior set',
        'Reuse the project’s existing output and alerting conventions',
        'Record enough context to explain why a rule fired',
        'Avoid bundling offline, replay, or profiling work into the first patch unless already trivial',
        ...(implementationCandidates.length > 0
          ? [`Treat these as likely implementation targets rather than confirmed edit points: ${implementationCandidates.slice(0, 4).join(', ')}.`]
          : []),
      ],
      files: implementationCandidates.slice(0, 4),
      estimatedMinutes: 90,
      dependencies: [3],
      validationCriteria: [
        'The first milestone is implemented end-to-end',
        'Output matches project conventions',
        'The patch remains narrowly scoped',
      ],
      pitfalls: [
        'Treat the listed files as investigation targets in remote mode, not guaranteed final edit locations.',
      ],
    });

    steps.push({
      number: 5,
      title: 'Add Deterministic Tests',
      description: 'Test the happy path, invalid sequences, and cleanup behavior before broadening the rules.',
      actions: [
        'Add synthetic tests for valid flows',
        'Add tests for missing responses, out-of-order inputs, and duplicate events',
        'Add cleanup tests for disconnects or session termination',
        'Use replayable or archived examples once the core path is working',
        ...(candidateTests.length > 0
          ? [`Start by checking whether tests already live near: ${candidateTests.slice(0, 3).join(', ')}.`]
          : []),
      ],
      files: candidateTests.slice(0, 3),
      estimatedMinutes: 60,
      dependencies: [4],
      validationCriteria: [
        'Happy-path and failure-path tests exist',
        'Cleanup behavior is covered',
        'The MVP can be validated without live traffic',
      ],
      pitfalls: [
        'Do not invent a new test style if the repo already has a pattern for integration or replay-driven testing.',
      ],
    });

    steps.push({
      number: 6,
      title: 'Document Scope and Follow-up Milestones',
      description: 'Make it clear what shipped now and what remains for later milestones.',
      actions: [
        'Document the supported contracts or behaviors',
        'Record false-positive caveats and observability limits',
        'List next milestones such as offline analysis, replay support, or behavior profiling',
        'Prepare the PR description with explicit scope boundaries',
      ],
      files: ['README.md', 'docs/**'],
      estimatedMinutes: 25,
      dependencies: [5],
      validationCriteria: [
        'Supported behavior is documented',
        'Known limitations are explicit',
        'Follow-up milestones are separated from the MVP',
      ],
      pitfalls: [
        'Do not over-document speculative future work as if it is already implemented.',
      ],
    });

    return steps;
  }

  private generateConcretePlan(
    issue: IssueInfo,
    issueDeps: {
      directlyAffected: string[];
      indirectlyAffected: string[];
      requiredChanges: string[];
      testFiles: string[];
    }
  ): ImplementationStep[] {
    const steps: ImplementationStep[] = [];
    let stepNumber = 1;

    steps.push({
      number: stepNumber++,
      title: 'Setup and Preparation',
      description: 'Create feature branch and review existing code',
      actions: this.generateSetupActions(issue, issueDeps.directlyAffected),
      files: [],
      estimatedMinutes: 15,
      dependencies: [],
      validationCriteria: [
        'Feature branch created',
        'All affected files reviewed',
        'Development environment ready',
      ],
      pitfalls: [
        'Do not start patching the first file you see without tracing where the relevant behavior actually enters the system.',
      ],
    });

    if (issueDeps.requiredChanges.length > 0) {
      steps.push({
        number: stepNumber++,
        title: 'Analyze and Update Dependencies',
        description: 'Review and update utility/helper functions if needed',
        actions: this.generateDependencyActions(issueDeps.requiredChanges),
        files: issueDeps.requiredChanges,
        estimatedMinutes: 30,
        dependencies: [1],
        validationCriteria: [
          'All dependencies reviewed',
          'Utility functions updated if needed',
          'No breaking changes introduced',
        ],
        pitfalls: [
          'Avoid changing shared helpers before confirming the issue cannot be solved in the caller or local module first.',
        ],
      });
    }

    const orderedFiles = this.dependencyMapper.suggestImplementationOrder(
      issueDeps.directlyAffected
    );

    for (let i = 0; i < orderedFiles.length; i++) {
      const file = orderedFiles[i];
      const isFirst = i === 0;
      const prevStepNum = isFirst ? (issueDeps.requiredChanges.length > 0 ? 2 : 1) : stepNumber - 1;

      steps.push({
        number: stepNumber++,
        title: `Implement Changes in ${this.getFileName(file)}`,
        description: this.generateStepDescription(file, issue),
        actions: this.generateActions(file, issue),
        files: [file],
        estimatedMinutes: this.estimateFileChangeTime(file, issue),
        dependencies: [prevStepNum],
        validationCriteria: this.generateImplementationValidation(file, issue),
        pitfalls: [
          `Do not add parallel logic paths in \`${file}\` if the existing code already has a single place that owns this behavior.`,
        ],
      });
    }

    if (issueDeps.testFiles.length > 0) {
      steps.push({
        number: stepNumber++,
        title: 'Update Existing Tests',
        description: 'Modify existing test files to cover new changes',
        actions: this.generateExistingTestActions(issue, issueDeps.testFiles),
        files: issueDeps.testFiles,
        estimatedMinutes: 45,
        dependencies: [stepNumber - 2],
        validationCriteria: [
          'All existing tests updated',
          'Test coverage maintained or improved',
          'All tests passing',
        ],
        pitfalls: [
          'Do not only update snapshots or fixtures; make sure at least one assertion proves the new behavior explicitly.',
        ],
      });
    }

    steps.push({
      number: stepNumber++,
      title: 'Add New Tests',
      description: 'Create comprehensive tests for new functionality',
      actions: this.generateNewTestActions(issue, issueDeps.directlyAffected),
      files: this.suggestNewTestFiles(issueDeps.directlyAffected),
      estimatedMinutes: 60,
      dependencies: [stepNumber - 2],
      validationCriteria: this.generateNewTestValidation(issue),
      pitfalls: [
        'Do not create tests that mirror the implementation too closely; assert observable behavior instead.',
      ],
    });

    if (issueDeps.indirectlyAffected.length > 0) {
      steps.push({
        number: stepNumber++,
        title: 'Integration Testing',
        description: 'Test integration with affected components',
        actions: this.generateIntegrationActions(issue, issueDeps.indirectlyAffected),
        files: issueDeps.indirectlyAffected,
        estimatedMinutes: 30,
        dependencies: [stepNumber - 2],
        validationCriteria: [
          'All tests passing',
          'No regressions detected',
          'Integration points verified',
        ],
        pitfalls: [
          'Do not stop after unit tests if the issue changes wiring between tools, handlers, or message flows.',
        ],
      });
    }

    steps.push({
      number: stepNumber++,
      title: 'Update Documentation',
      description: 'Update relevant documentation and comments',
      actions: this.generateDocumentationActions(issue, issueDeps.directlyAffected),
      files: ['README.md', 'docs/**'],
      estimatedMinutes: 20,
      dependencies: [stepNumber - 2],
      validationCriteria: this.generateDocumentationValidation(issue),
      pitfalls: [
        'Do not add broad README churn if the issue only changes an internal behavior contract.',
      ],
    });

    steps.push({
      number: stepNumber++,
      title: 'Prepare for Code Review',
      description: 'Final checks and PR preparation',
      actions: this.generateReviewActions(issue, issueDeps.directlyAffected),
      files: [],
      estimatedMinutes: 15,
      dependencies: [stepNumber - 2],
      validationCriteria: this.generateReviewValidation(issue),
      pitfalls: [
        'Do not open a PR without listing the exact files touched and how they relate to the issue objective.',
      ],
    });

    return steps;
  }

  /**
   * Get file name from path
   */
  private getFileName(filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }

  /**
   * Generate step description for a file
   */
  private generateStepDescription(file: string, issue: IssueInfo): string {
    const fileName = this.getFileName(file);

    switch (issue.type) {
      case 'bug':
        return `Fix the bug in ${fileName} according to the issue description`;
      case 'feature':
        return `Implement new feature in ${fileName}`;
      case 'enhancement':
        return `Enhance functionality in ${fileName}`;
      case 'refactor':
        return `Refactor code in ${fileName} to improve quality`;
      default:
        return `Make required changes to ${fileName}`;
    }
  }

  private summarizeObjective(issue: IssueInfo): string {
    return issue.requirements[0] || issue.acceptanceCriteria[0] || issue.title;
  }

  private generateSetupActions(issue: IssueInfo, affectedFiles: string[]): string[] {
    const actions: string[] = [
      'Create a new feature branch from main/master.',
      `Read the issue title, requirements, and acceptance criteria until you can restate the objective as: "${this.summarizeObjective(issue)}".`,
    ];

    if (affectedFiles.length > 0) {
      actions.push(`Open the first likely implementation files before coding: ${affectedFiles.slice(0, 3).join(', ')}.`);
      actions.push('Trace where those files are imported or invoked so you understand the full code path that will change.');
    } else {
      actions.push('Identify the first likely code path from the project overview and starting-file recommendations before editing any code.');
    }

    actions.push('Run the project or test baseline once so you know the current behavior before introducing changes.');
    return actions;
  }

  private generateDependencyActions(requiredChanges: string[]): string[] {
    return [
      `Review the shared files that may need coordination changes: ${requiredChanges.slice(0, 3).join(', ')}.`,
      'Check whether any exported types, helpers, or shared constants must change to support the main implementation.',
      'Avoid breaking callers by preserving existing signatures unless the issue explicitly requires a wider API change.',
    ];
  }

  /**
   * Generate actions for a file
   */
  private generateActions(file: string, issue: IssueInfo): string[] {
    const objective = this.summarizeObjective(issue);
    const fileName = this.getFileName(file);
    const fileType = this.detectWorkFileType(file);
    const actions: string[] = [
      `Open \`${file}\` and identify the exported function, class, or handler that currently owns the behavior closest to: ${objective}.`,
      `Trace the inputs, outputs, and adjacent callers around \`${fileName}\` so you know exactly where the new behavior must be inserted.`,
    ];

    switch (issue.type) {
      case 'bug':
        actions.push(`Reproduce the failing behavior in or around \`${fileName}\`, then change the smallest code path that fixes the root cause.`);
        break;
      case 'feature':
        actions.push(`Add the new behavior directly in \`${fileName}\` while preserving the surrounding public contract unless the issue says otherwise.`);
        break;
      case 'enhancement':
        actions.push(`Adjust the existing logic in \`${fileName}\` to improve the current behavior without regressing supported flows.`);
        break;
      case 'refactor':
        actions.push(`Restructure \`${fileName}\` to improve clarity while preserving observable behavior before and after the change.`);
        break;
      default:
        actions.push(`Implement the required change in \`${fileName}\` using the narrowest code path possible.`);
        break;
    }

    if (fileType === 'agent') {
      actions.push(`Update the agent decision/prompt/state logic in \`${fileName}\` so the issue-specific behavior happens through the existing agent lifecycle, not as a separate side path.`);
    } else if (fileType === 'service') {
      actions.push(`Keep business logic in \`${fileName}\` and avoid moving transport or controller concerns into the service layer.`);
    } else if (fileType === 'component') {
      actions.push(`Keep UI state changes localized in \`${fileName}\` and trace any props or hooks that need to reflect the new behavior.`);
    }

    actions.push(`Add or update nearby type guards, return types, or schema handling in \`${fileName}\` if the new behavior changes data shape.`);
    actions.push(`Keep the implementation aligned with existing patterns already used in neighboring files to avoid introducing a one-off design.`);

    return actions;
  }

  private generateImplementationValidation(file: string, issue: IssueInfo): string[] {
    return [
      `The change in \`${file}\` directly satisfies the issue objective: ${this.summarizeObjective(issue)}.`,
      `The code path in \`${file}\` still follows the surrounding repository patterns and type conventions.`,
      'No new lint, type, or obvious runtime issues were introduced.',
      'The updated behavior is covered by a focused test or existing test extension.',
    ];
  }

  private generateExistingTestActions(issue: IssueInfo, testFiles: string[]): string[] {
    return [
      `Open the nearest existing tests first: ${testFiles.slice(0, 3).join(', ')}.`,
      `Extend the existing test cases so they assert the new expected behavior for: ${this.summarizeObjective(issue)}.`,
      'Keep the test style consistent with the current repository instead of introducing a new testing pattern for one issue.',
    ];
  }

  private generateNewTestActions(issue: IssueInfo, affectedFiles: string[]): string[] {
    const targetFiles = this.suggestNewTestFiles(affectedFiles);
    return [
      `Create or update focused tests near the implementation area: ${targetFiles.slice(0, 3).join(', ') || 'the nearest existing test file'}.`,
      `Write one happy-path test that proves the issue objective now works: ${this.summarizeObjective(issue)}.`,
      'Add at least one edge-case or failure-path test that would have caught the regression or missing behavior earlier.',
      'If the issue changes interactions between modules, add one integration-style assertion that proves the wiring still works end-to-end.',
    ];
  }

  private generateNewTestValidation(issue: IssueInfo): string[] {
    return [
      `The tests prove the main expected outcome for: ${this.summarizeObjective(issue)}.`,
      'At least one edge case or failure path is covered.',
      'The new tests fail without the implementation change and pass with it.',
    ];
  }

  private generateIntegrationActions(issue: IssueInfo, indirectlyAffected: string[]): string[] {
    return [
      'Run the smallest relevant test command first, then the broader suite if the local repo supports it.',
      `Smoke-test the dependent files most likely to observe the change: ${indirectlyAffected.slice(0, 3).join(', ')}.`,
      `Verify the issue objective still holds when the updated code is exercised through its normal integration path, not just in isolation.`,
    ];
  }

  private generateDocumentationActions(issue: IssueInfo, affectedFiles: string[]): string[] {
    return [
      `Update inline comments only where the changed behavior in ${affectedFiles.slice(0, 2).join(', ') || 'the implementation files'} would otherwise be hard to understand.`,
      `If "${this.summarizeObjective(issue)}" changes developer-facing or user-facing behavior, document that change in README or nearby docs.`,
      'If the change is internal-only, say so explicitly and keep the documentation local to the code instead of editing the README.',
      'Do not add broad documentation churn; document only the new contract, caveat, or usage pattern introduced by this issue.',
    ];
  }

  private generateDocumentationValidation(issue: IssueInfo): string[] {
    return [
      'Any non-obvious behavior change is documented close to the code or in the relevant project docs.',
      `The documentation reflects the new expected behavior for: ${this.summarizeObjective(issue)}.`,
    ];
  }

  private generateReviewActions(issue: IssueInfo, affectedFiles: string[]): string[] {
    return [
      `Re-read the final diff starting with: ${affectedFiles.slice(0, 3).join(', ') || 'the changed files'}.`,
      `Write a PR summary that explains the problem, the chosen code path, and how the implementation now achieves: ${this.summarizeObjective(issue)}.`,
      'Include the exact tests or manual verification steps you used so another contributor can validate the change quickly.',
    ];
  }

  private generateReviewValidation(issue: IssueInfo): string[] {
    return [
      'The final diff is small enough to review confidently.',
      `The PR description explains how the code changes achieve: ${this.summarizeObjective(issue)}.`,
      'Validation steps are explicit and reproducible by another developer.',
    ];
  }

  private detectWorkFileType(file: string): 'agent' | 'service' | 'component' | 'test' | 'source' {
    const lower = file.toLowerCase();
    if (lower.includes('agent')) return 'agent';
    if (lower.includes('service') || lower.includes('api')) return 'service';
    if (lower.includes('component') || lower.endsWith('.tsx') || lower.endsWith('.jsx')) return 'component';
    if (lower.includes('.test.') || lower.includes('.spec.')) return 'test';
    return 'source';
  }

  private async enrichSteps(
    steps: ImplementationStep[],
    issue: IssueInfo,
    issueDeps: {
      directlyAffected: string[];
      indirectlyAffected: string[];
      requiredChanges: string[];
      testFiles: string[];
    },
    startingPoints: FileRecommendation[]
  ): Promise<ImplementationStep[]> {
    const branchName = this.buildBranchName(issue);
    const readmeContent = await this.getReadmeContent();

    return await Promise.all(steps.map(async (step) => {
      const resources: StepResource[] = [];

      if (step.title === 'Setup and Preparation') {
        resources.push({
          title: 'Create Branch',
          type: 'command',
          language: 'bash',
          content: `git checkout -b ${branchName}`,
          description: 'Suggested branch name based on the issue title.',
        });

        if (readmeContent) {
          resources.push({
            title: 'README Context',
            type: 'file_excerpt',
            language: 'markdown',
            path: 'README.md',
            content: readmeContent,
            description: 'Read this first so you understand the project purpose and contributor workflow.',
          });
        }
      }

      for (const file of step.files.slice(0, 2)) {
        const excerpt = await this.getFileExcerpt(file, issue);
        if (excerpt) {
          resources.push({
            title: `Current Code: ${file}`,
            type: 'file_excerpt',
            language: this.detectLanguage(file),
            path: file,
            content: excerpt,
            description: 'Current code excerpt or candidate investigation context.',
          });
        }
      }

      if (step.title.includes('Implement Changes') || step.title === 'Implement the MVP Slice') {
        const target = (step.files[0] || startingPoints.find(point => this.isImplementationCandidate(point.path))?.path);
        if (target && this.canGenerateImplementationPreview(target)) {
          const currentContent = await this.getRawFileContent(target);
          const snippet = this.buildImplementationSnippet(target, issue, currentContent || '');
          if (snippet && currentContent) {
            const style = CodeIntelligence.analyzeStyle(currentContent);
            const adapted = CodeIntelligence.adaptCodeStyle(snippet, style, target);
            const insertionPoint = CodeIntelligence.detectInsertionPoint(target, currentContent, adapted);
            const conflictReport = CodeIntelligence.detectConflicts(currentContent, adapted);
            const diff = CodeIntelligence.generateUnifiedDiff(currentContent, target, insertionPoint, adapted);

            resources.push({
              title: 'Insertion Point Detection',
              type: 'warning',
              path: target,
              content: `Insert near line ${insertionPoint.line} (${Math.round(insertionPoint.confidence * 100)}% confidence)\nAnchor: ${insertionPoint.anchor}\nReason: ${insertionPoint.reason}`,
              description: 'Best detected insertion point for the generated code.',
              confidence: insertionPoint.confidence,
              reason: insertionPoint.reason,
            });

            resources.push({
              title: 'Conflict Detection',
              type: 'warning',
              path: target,
              content: conflictReport.hasConflicts
                ? conflictReport.conflicts.join('\n')
                : 'No conflicting classes, functions, imports, or types detected in the current file excerpt.',
              description: 'Potential naming or structural conflicts in the target file.',
            });

            resources.push({
              title: 'Style Pattern Analysis',
              type: 'warning',
              path: target,
              content: `Indentation: ${JSON.stringify(style.indentUnit)}\nQuote style: ${style.quoteStyle}\nSemicolons: ${style.semicolons ? 'enabled' : 'disabled'}\nTrailing commas: ${style.trailingComma ? 'enabled' : 'disabled'}`,
              description: 'Detected local repository style signals used to adapt the snippet.',
            });

            resources.push({
              title: 'Suggested Code To Add',
              type: 'code',
              language: this.detectLanguage(target),
              path: target,
              content: adapted,
              description: 'Auto-adapted scaffold matched to the detected repo style.',
            });

            resources.push({
              title: 'Unified Diff Preview',
              type: 'diff',
              language: 'diff',
              path: target,
              content: diff,
              description: 'Git-apply compatible insertion diff with nearby context.',
            });
          }

          const codePathHints = this.buildCodePathHints(target, currentContent || '');
          if (codePathHints.length > 0) {
            resources.push({
              title: 'Code Path Hints',
              type: 'warning',
              path: target,
              content: codePathHints.join('\n'),
              description: 'Likely target symbol, callers, and nearby dependencies worth tracing before editing.',
            });
          }
        } else if (target) {
          resources.push({
            title: 'Implementation Target Warning',
            type: 'warning',
            path: target,
            content: `Bob treats \`${target}\` as investigation context, not a confirmed code-edit location. Prefer executable source files before generating a patch preview in remote mode.`,
            description: 'No patch preview was generated because the candidate file is documentation, schema, or low-confidence context.',
          });
        }
      }

      if (step.title.includes('Test')) {
        const target = step.files[0] || this.findVerifiedTestTarget(undefined, issueDeps.directlyAffected[0] || startingPoints[0]?.path || '');
        if (target) {
          const scaffold = this.buildTestSnippet(target, issue, issueDeps.directlyAffected[0] || startingPoints[0]?.path || target);
          const currentTestContent = await this.getRawFileContent(target);
          const adaptedTest = currentTestContent
            ? CodeIntelligence.adaptCodeStyle(scaffold, CodeIntelligence.analyzeStyle(currentTestContent), target)
            : scaffold;

          resources.push({
            title: 'Suggested Test Scaffold',
            type: 'code',
            language: this.detectLanguage(target),
            path: target,
            content: adaptedTest,
            description: 'Generated from acceptance criteria and adapted to the detected local test style when possible.',
          });
        }
      }

      if (step.title === 'Update Documentation') {
        resources.push({
          title: 'Documentation Command',
          type: 'command',
          language: 'bash',
          content: `rg -n "${this.escapeForRg(this.summarizeObjective(issue).split(' ').slice(0, 5).join(' '))}" README.md docs || true`,
          description: 'Search docs for the old behavior before updating them.',
        });
      }

      return {
        ...step,
        resources,
      };
    }));
  }

  private buildBranchName(issue: IssueInfo): string {
    const slug = issue.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    return `bob/issue-${issue.number}-${slug || 'change'}`;
  }

  private async getReadmeContent(): Promise<string> {
    try {
      if (this.repoInfo.source === 'local') {
        const candidates = ['README.md', 'README.MD', 'Readme.md'];
        for (const candidate of candidates) {
          const fullPath = path.join(this.repoInfo.path, candidate);
          if (fs.existsSync(fullPath)) {
            return this.trimContent(fs.readFileSync(fullPath, 'utf-8'));
          }
        }
        return '';
      }

      const slug = this.repoInfo.slug;
      if (!slug) return '';
      const [owner, repo] = slug.split('/');
      return this.trimContent(await this.githubClient.getReadme(owner, repo));
    } catch {
      return '';
    }
  }

  private async getFileExcerpt(file: string, issue: IssueInfo): Promise<string> {
    if (!file) return '';

    try {
      const content = await this.getRawFileContent(file);
      if (!content) return '';

      return this.extractRelevantExcerpt(content, file, issue);
    } catch {
      return '';
    }
  }

  private async getRawFileContent(file: string): Promise<string> {
    try {
      if (!file) return '';

      if (this.repoInfo.source === 'local') {
        const fullPath = path.join(this.repoInfo.path, file);
        if (!fs.existsSync(fullPath)) return '';
        return fs.readFileSync(fullPath, 'utf-8');
      }

      const slug = this.repoInfo.slug;
      if (!slug) return '';
      const [owner, repo] = slug.split('/');
      return await this.githubClient.getFileContent(owner, repo, file, this.repoInfo.defaultBranch);
    } catch {
      return '';
    }
  }

  private extractRelevantExcerpt(content: string, file: string, issue: IssueInfo): string {
    const lines = content.split('\n');
    const keywords = [
      ...issue.title.toLowerCase().split(/[^a-z0-9]+/),
      ...issue.requirements.join(' ').toLowerCase().split(/[^a-z0-9]+/),
    ].filter(word => word.length > 3);

    let start = 0;
    const foundIndex = lines.findIndex(line => keywords.some(keyword => line.toLowerCase().includes(keyword)));
    if (foundIndex >= 0) {
      start = Math.max(0, foundIndex - 5);
    } else if (file.endsWith('README.md') || file.toLowerCase().includes('readme')) {
      start = 0;
    }

    return this.trimContent(lines.slice(start, start + 30).join('\n'));
  }

  private trimContent(content: string): string {
    return content.split('\n').slice(0, 30).join('\n').trim();
  }

  private buildImplementationSnippet(file: string, issue: IssueInfo, currentContent: string): string {
    const objective = this.summarizeObjective(issue);
    const language = this.detectLanguage(file);
    const symbols = this.detectRelevantSymbols(currentContent);
    const lowerObjective = objective.toLowerCase();
    const className = symbols.classes.find(name => /agent/i.test(name)) || symbols.classes[0];
    const targetMethod = symbols.functions.find(name => /run|plan|act|think|operation|memory|prompt|write|conversation/i.test(name)) || symbols.functions[0];
    const actionName = this.buildCamelName(objective);

    if (language === 'rust') {
      const targetFn = targetMethod || 'handle_contract_rule';
      if (lowerObjective.includes('ping') || lowerObjective.includes('pong') || lowerObjective.includes('verack') || lowerObjective.includes('version')) {
        return `// Candidate implementation for issue #${issue.number}: ${objective}\n// Extend \`${targetFn}\` with a deterministic protocol-contract check.\nmatch (&event.command[..], event.direction) {\n    (\"ping\", Direction::Outbound) => {\n        state.last_ping_nonce = event.nonce;\n        state.awaiting_pong = true;\n    }\n    (\"pong\", Direction::Inbound) if state.awaiting_pong && state.last_ping_nonce == event.nonce => {\n        state.awaiting_pong = false;\n    }\n    (\"pong\", Direction::Inbound) => {\n        findings.push(Finding::new(\n            \"unexpected-pong\",\n            \"received pong without a matching outbound ping nonce\",\n        ));\n    }\n    _ => {}\n}\n`;
      }

      return `// Candidate implementation for issue #${issue.number}: ${objective}\n// Add this near \`${targetFn}\` or inline the logic into the existing rule path.\nif should_flag_${this.buildSnakeName(objective)}(&state, &event) {\n    findings.push(Finding::new(\n        \"${this.buildKebabName(objective)}\",\n        \"${objective}\",\n    ));\n}\n`;
    }

    if (language === 'typescript' || language === 'javascript') {
      if (className && lowerObjective.includes('researcher') && lowerObjective.includes('paper')) {
        return `// Candidate implementation for issue #${issue.number}: ${objective}\n// Add this inside \`${className}\`, near \`${targetMethod || 'the existing decision/action path'}\`.\nprivate shouldWritePaper() {\n  const role = this.description?.toLowerCase() || '';\n  const alreadyWriting = this.activity?.type === 'writePaper';\n  return role.includes('researcher') && !alreadyWriting;\n}\n\nprivate nextResearcherAction() {\n  if (!this.shouldWritePaper()) {\n    return null;\n  }\n\n  return {\n    type: 'writePaper',\n    payload: {\n      topic: this.toRemember,\n    },\n    reason: 'researcher agent should prioritize paper-writing behavior when idle',\n  };\n}\n\n// In ${targetMethod || 'the existing action-selection method'}, prefer:\n// const researcherAction = this.nextResearcherAction();\n// if (researcherAction) return researcherAction;\n`;
      }

      if (targetMethod) {
        return `// Candidate implementation for issue #${issue.number}: ${objective}\n// Extend \`${targetMethod}\` rather than creating a parallel execution path.\nconst nextIssueAction = {\n  type: '${actionName}',\n  reason: '${objective}',\n};\n\nif (shouldHandle${this.buildPascalName(objective)}(/* existing inputs */)) {\n  return nextIssueAction;\n}\n`;
      }
    }

    return `// TODO(issue #${issue.number}): implement ${objective}\n// Add the smallest change here that satisfies the issue objective.\n`;
  }

  private buildTestSnippet(testFile: string, issue: IssueInfo, implementationFile: string): string {
    const objective = this.summarizeObjective(issue);
    const language = this.detectLanguage(testFile);

    if (language === 'rust') {
      return `#[test]\nfn issue_${issue.number}_${this.buildSlug(objective)}() {\n    // arrange: build the smallest input or event sequence from ${implementationFile}\n    // act: execute the code path under test\n    // assert: prove ${objective}\n    assert!(true);\n}\n`;
    }

    if (language === 'typescript' || language === 'javascript') {
      return `it('issue #${issue.number}: ${objective}', async () => {\n  // arrange: create the smallest input that exercises ${implementationFile}\n  // act: call the target function or workflow\n  // assert: verify the new behavior explicitly\n});\n`;
    }

    return `# Test scaffold for issue #${issue.number}\n# Assert the expected behavior: ${objective}\n`;
  }

  private buildSlug(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'behavior';
  }

  private buildSnakeName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'behavior';
  }

  private buildKebabName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'behavior';
  }

  private buildCamelName(value: string): string {
    const parts = value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (parts.length === 0) return 'issueBehavior';
    return parts[0] + parts.slice(1).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  }

  private buildPascalName(value: string): string {
    const camel = this.buildCamelName(value);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  }

  private detectLanguage(file: string): string {
    if (file.endsWith('.rs')) return 'rust';
    if (file.endsWith('.ts') || file.endsWith('.tsx')) return 'typescript';
    if (file.endsWith('.js') || file.endsWith('.jsx')) return 'javascript';
    if (file.endsWith('.md')) return 'markdown';
    if (file.endsWith('.proto')) return 'protobuf';
    if (file.endsWith('.go')) return 'go';
    if (file.endsWith('.py')) return 'python';
    return 'text';
  }

  private escapeForRg(value: string): string {
    return value.replace(/"/g, '\\"');
  }

  /**
   * Estimate time for file changes
   */
  private estimateFileChangeTime(file: string, issue: IssueInfo): number {
    let baseTime = 30; // Base time in minutes

    // Adjust based on complexity
    switch (issue.complexity) {
      case 'critical':
        baseTime *= 3;
        break;
      case 'high':
        baseTime *= 2;
        break;
      case 'medium':
        baseTime *= 1.5;
        break;
      case 'low':
        baseTime *= 1;
        break;
    }

    // Adjust based on issue type
    switch (issue.type) {
      case 'bug':
        baseTime *= 1.2; // Bugs often take longer to debug
        break;
      case 'feature':
        baseTime *= 1.5; // Features are more complex
        break;
      case 'refactor':
        baseTime *= 1.3; // Refactoring requires careful consideration
        break;
    }

    return Math.round(baseTime);
  }

  /**
   * Suggest new test files
   */
  private suggestNewTestFiles(affectedFiles: string[]): string[] {
    return affectedFiles
      .map(file => this.findVerifiedTestTarget(undefined, file))
      .filter((file): file is string => Boolean(file));
  }

  /**
   * Create test strategy
   */
  private createTestStrategy(
    issue: IssueInfo,
    issueDeps: {
      directlyAffected: string[];
      indirectlyAffected: string[];
      requiredChanges: string[];
      testFiles: string[];
    }
  ): TestStrategy {
    const unitTests: string[] = [];
    const integrationTests: string[] = [];
    const e2eTests: string[] = [];

    // Unit tests for directly affected files
    for (const file of issueDeps.directlyAffected) {
      unitTests.push(`Test all functions in ${this.getFileName(file)}`);
      unitTests.push(`Test error handling in ${this.getFileName(file)}`);
    }

    // Integration tests if multiple components affected
    if (issueDeps.directlyAffected.length > 1) {
      integrationTests.push('Test interaction between modified components');
      integrationTests.push('Verify data flow between components');
    }

    // E2E tests for user-facing changes
    if (issue.type === 'feature' || issue.type === 'enhancement') {
      e2eTests.push('Test complete user workflow');
      e2eTests.push('Verify all acceptance criteria');
    }

    return {
      unitTests,
      integrationTests,
      e2eTests,
      coverageTarget: this.determineCoverageTarget(issue),
      criticalPaths: this.identifyCriticalPaths(issue, issueDeps),
    };
  }

  /**
   * Determine coverage target
   */
  private determineCoverageTarget(issue: IssueInfo): number {
    switch (issue.complexity) {
      case 'critical':
        return 95;
      case 'high':
        return 90;
      case 'medium':
        return 85;
      case 'low':
        return 80;
      default:
        return 80;
    }
  }

  /**
   * Identify critical paths
   */
  private identifyCriticalPaths(
    issue: IssueInfo,
    issueDeps: {
      directlyAffected: string[];
      indirectlyAffected: string[];
      requiredChanges: string[];
      testFiles: string[];
    }
  ): string[] {
    const paths: string[] = [];

    // Add acceptance criteria as critical paths
    for (const criteria of issue.acceptanceCriteria) {
      paths.push(criteria);
    }

    // Add paths based on affected components
    if (issueDeps.directlyAffected.length > 0) {
      paths.push('Main functionality in affected components');
    }

    if (issueDeps.indirectlyAffected.length > 0) {
      paths.push('Integration with dependent components');
    }

    return paths;
  }

  /**
   * Assess risks
   */
  private assessRisks(
    issue: IssueInfo,
    issueDeps: {
      directlyAffected: string[];
      indirectlyAffected: string[];
      requiredChanges: string[];
      testFiles: string[];
    },
    dependencyMap: DependencyMap
  ): RiskAssessment[] {
    const risks: RiskAssessment[] = [];

    // Risk: High number of affected files
    if (issueDeps.indirectlyAffected.length > 5) {
      risks.push({
        level: 'high',
        description: 'Large number of indirectly affected files',
        impact: 'Changes may have unexpected side effects',
        mitigation: [
          'Comprehensive integration testing',
          'Careful code review',
          'Gradual rollout if possible',
        ],
      });
    }

    // Risk: Critical complexity
    if (issue.complexity === 'critical') {
      risks.push({
        level: 'high',
        description: 'Critical complexity issue',
        impact: 'Implementation may be time-consuming and error-prone',
        mitigation: [
          'Break down into smaller tasks',
          'Pair programming recommended',
          'Multiple review rounds',
        ],
      });
    }

    // Risk: High impact components
    const highImpactFiles = issueDeps.directlyAffected.filter(file => {
      const node = dependencyMap.nodes.find(n => n.path === file);
      return node && (node.changeImpact === 'high' || node.changeImpact === 'critical');
    });

    if (highImpactFiles.length > 0) {
      risks.push({
        level: 'medium',
        description: 'Changes to high-impact components',
        impact: 'Many other components depend on these files',
        mitigation: [
          'Maintain backward compatibility',
          'Add deprecation warnings if needed',
          'Thorough testing of dependent components',
        ],
      });
    }

    // Risk: No existing tests
    if (issueDeps.testFiles.length === 0) {
      risks.push({
        level: 'medium',
        description: 'No existing test coverage',
        impact: 'Harder to verify correctness and prevent regressions',
        mitigation: [
          'Create comprehensive test suite',
          'Add tests before making changes',
          'Consider adding integration tests',
        ],
      });
    }

    // Risk: Breaking changes
    if (issue.type === 'refactor' || issue.description.toLowerCase().includes('breaking')) {
      risks.push({
        level: 'high',
        description: 'Potential breaking changes',
        impact: 'May break existing functionality or API contracts',
        mitigation: [
          'Document all breaking changes',
          'Provide migration guide',
          'Consider deprecation period',
          'Update all dependent code',
        ],
      });
    }

    return risks;
  }

  /**
   * Estimate effort in hours
   */
  private estimateEffort(
    issue: IssueInfo,
    steps: ImplementationStep[],
    risks: RiskAssessment[]
  ): number {
    // Sum up all step estimates
    const totalMinutes = steps.reduce((sum, step) => sum + step.estimatedMinutes, 0);
    let hours = totalMinutes / 60;

    // Add buffer based on complexity
    const complexityBuffer = {
      low: 1.1,
      medium: 1.3,
      high: 1.5,
      critical: 2.0,
    };

    hours *= complexityBuffer[issue.complexity];

    // Add buffer based on risks
    const highRisks = risks.filter(r => r.level === 'high').length;
    hours *= 1 + (highRisks * 0.2);

    return Math.round(hours * 2) / 2; // Round to nearest 0.5 hour
  }

  /**
   * Suggest review points
   */
  private suggestReviewPoints(steps: ImplementationStep[]): string[] {
    const reviewPoints: string[] = [];

    // Review after core implementation
    const coreSteps = steps.filter(s => 
      s.title.includes('Implement Changes') || s.title.includes('Update Dependencies')
    );

    if (coreSteps.length > 0) {
      reviewPoints.push(`After step ${coreSteps[coreSteps.length - 1].number}: Review core implementation`);
    }

    // Review after tests
    const testSteps = steps.filter(s => s.title.includes('Test'));
    if (testSteps.length > 0) {
      reviewPoints.push(`After step ${testSteps[testSteps.length - 1].number}: Review test coverage`);
    }

    // Final review
    reviewPoints.push(`After step ${steps.length}: Final code review before PR`);

    return reviewPoints;
  }

  /**
   * Identify prerequisites
   */
  private identifyPrerequisites(issue: IssueInfo): string[] {
    const prerequisites: string[] = [];

    // Check for related issues
    if (issue.relatedIssues.length > 0) {
      prerequisites.push(
        `Review related issues: ${issue.relatedIssues.map(i => `#${i}`).join(', ')}`
      );
    }

    // Check for dependencies in requirements
    const reqText = issue.requirements.join(' ').toLowerCase();
    if (reqText.includes('after') || reqText.includes('depends on')) {
      prerequisites.push('Verify all dependent issues are resolved');
    }

    // Add common prerequisites
    prerequisites.push('Ensure development environment is set up');
    prerequisites.push('Have necessary access permissions');
    prerequisites.push('Understand the existing codebase architecture');

    return prerequisites;
  }

  private buildWarnings(
    issue: IssueInfo,
    issueDeps: {
      directlyAffected: string[];
      indirectlyAffected: string[];
      requiredChanges: string[];
      testFiles: string[];
    }
  ): string[] {
    const warnings: string[] = [];

    if (issue.source !== 'github-api') {
      warnings.push('Issue data is not sourced from the GitHub API, so the plan may be incomplete.');
    }

    if (issueDeps.directlyAffected.length === 0) {
      warnings.push('No concrete repository files were identified from the issue text. Treat this as a design-first contribution plan.');
    }

    if (issue.requirements.length === 0 && issue.acceptanceCriteria.length === 0) {
      warnings.push('The issue does not define concrete requirements or acceptance criteria. Expect follow-up clarification before coding.');
    }

    return warnings;
  }

  private buildProjectOverview(): string[] {
    const overview: string[] = [];

    if (this.repoInfo.overview) {
      overview.push(this.repoInfo.overview);
    }

    if (this.repoInfo.type) {
      overview.push(`Project type: ${this.repoInfo.type}`);
    }

    const tech = [this.repoInfo.techStack.language, this.repoInfo.techStack.framework, this.repoInfo.techStack.testFramework]
      .filter(Boolean)
      .join(' | ');
    if (tech) {
      overview.push(`Tech stack: ${tech}`);
    }

    if (this.repoInfo.highlights && this.repoInfo.highlights.length > 0) {
      overview.push(...this.repoInfo.highlights.slice(0, 3));
    }

    if (this.repoInfo.structure.entryPoints.length > 0) {
      overview.push(`Likely entry points: ${this.repoInfo.structure.entryPoints.slice(0, 3).join(', ')}`);
    }

    return [...new Set(overview)].slice(0, 6);
  }

  private buildEvidence(recommendedStartingPoints: FileRecommendation[]): EvidenceItem[] {
    const evidence: EvidenceItem[] = [
      { label: 'inspect repository structure', detail: `${this.repoInfo.structure.directories.length} directories analyzed` },
      { label: 'read README context', detail: this.repoInfo.overview || 'README summary extracted' },
      { label: 'identify likely affected files', detail: `${recommendedStartingPoints.length} candidate files ranked` },
      { label: 'generate implementation roadmap', detail: `${this.repoInfo.source} repository guidance with step validation` },
      { label: 'detect insertion point', detail: 'best-effort semantic and structural insertion analysis' },
      { label: 'produce diff preview', detail: 'git-apply compatible preview when file content is available' },
    ];

    return evidence;
  }

  private buildRiskSummary(
    issue: IssueInfo,
    risks: RiskAssessment[],
    issueDeps: {
      directlyAffected: string[];
      indirectlyAffected: string[];
      requiredChanges: string[];
      testFiles: string[];
    }
  ): RiskSummary {
    const highest = risks.find(risk => risk.level === 'critical')
      || risks.find(risk => risk.level === 'high')
      || risks.find(risk => risk.level === 'medium');

    if (highest) {
      return {
        level: highest.level,
        reason: highest.description,
      };
    }

    if (issueDeps.directlyAffected.some(file => /agent|simulation|engine|state/i.test(file))) {
      return {
        level: 'medium',
        reason: 'Agent lifecycle changes may affect simulation behavior.',
      };
    }

    return {
      level: 'low',
      reason: 'The current plan is scoped to a narrow change surface.',
    };
  }

  private buildPrDraft(issue: IssueInfo, recommendedStartingPoints: FileRecommendation[]): PrDraft {
    const primaryFile = recommendedStartingPoints[0]?.path || 'implementation file';
    const testTarget = this.findLikelyTestFile(recommendedStartingPoints) || 'nearest existing behavior test';
    const titleVerb = issue.type === 'bug' ? 'Fix' : issue.type === 'feature' ? 'Add' : 'Update';
    const titleSubject = this.summarizeObjective(issue)
      .replace(/^(implement|add|support|fix|update)\s+/i, '')
      .replace(/\.$/, '')
      .trim() || issue.title;

    return {
      title: `${titleVerb} ${titleSubject.charAt(0).toLowerCase() + titleSubject.slice(1)}`,
      summary: [
        `updates ${primaryFile} to address ${this.summarizeObjective(issue)}`,
        'adds regression coverage for the changed behavior',
        'documents the expected behavior where needed',
      ],
      tests: [
        `${path.basename(testTarget)} or nearest existing behavior test`,
        'manual simulation or runtime verification of the changed flow',
      ],
    };
  }

  private detectRelevantSymbols(content: string): { classes: string[]; functions: string[] } {
    const classes = Array.from(content.matchAll(/class\s+(\w+)/g)).map(match => match[1]);
    const functions = [
      ...Array.from(content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/g)).map(match => match[1]),
      ...Array.from(content.matchAll(/(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/g)).map(match => match[1]),
    ].filter(name => !['if', 'for', 'switch', 'while', 'catch'].includes(name));

    return {
      classes: Array.from(new Set(classes)),
      functions: Array.from(new Set(functions)),
    };
  }

  private buildCodePathHints(file: string, currentContent: string): string[] {
    const hints: string[] = [];
    const component = this.repoInfo.structure.keyComponents.find(entry => entry.path === file);
    const symbols = this.detectRelevantSymbols(currentContent);
    const targetSymbol = symbols.functions.find(name => /run|plan|act|think|operation|memory|prompt|write/i.test(name))
      || symbols.functions[0]
      || symbols.classes[0];

    if (targetSymbol) {
      hints.push(`Target symbol: ${targetSymbol}`);
    }

    if (component?.exports?.length) {
      hints.push(`Exports in this file: ${component.exports.slice(0, 4).join(', ')}`);
    }

    if (component?.dependencies?.length) {
      hints.push(`Nearby dependencies to trace: ${component.dependencies.slice(0, 4).join(', ')}`);
    }

    const likelyCallers = this.repoInfo.structure.keyComponents
      .filter(entry => entry.dependencies.includes(file) || entry.dependencies.some(dep => file.endsWith(dep) || dep.endsWith(path.basename(file))))
      .map(entry => entry.path)
      .slice(0, 4);

    if (likelyCallers.length > 0) {
      hints.push(`Likely callers or importers: ${likelyCallers.join(', ')}`);
    }

    return hints;
  }

  private buildProjectActionGuide(issue: IssueInfo): ProjectActionGuide[] {
    const guide: ProjectActionGuide[] = [];
    const { techStack, structure, source, type } = this.repoInfo;
    const topDirs = structure.directories.slice(0, 3).map(dir => dir.path);

    guide.push({
      title: 'Orient Yourself',
      actions: [
        source === 'local'
          ? 'Read the local README and package metadata first to confirm how this repository is expected to run.'
          : 'Start with the GitHub README, repo description, and issue discussion to confirm the project’s purpose and contributor expectations.',
        structure.entryPoints.length > 0
          ? `Open the likely entry points first: ${structure.entryPoints.slice(0, 3).join(', ')}.`
          : 'Identify the main executable or exported entry files before changing issue-specific code.',
        topDirs.length > 0
          ? `Map the top-level working areas before coding: ${topDirs.join(', ')}.`
          : 'Scan the top-level directories to separate core logic, tests, and tooling.',
      ],
    });

    const runActions: string[] = [];
    if (techStack.packageManager === 'cargo') {
      runActions.push('Run `cargo test` and `cargo check` early so you know the repo’s current baseline.');
    } else if (techStack.packageManager === 'go') {
      runActions.push('Run `go test ./...` to establish the current baseline before touching implementation files.');
    } else {
      runActions.push(`Install and validate the baseline with \`${techStack.packageManager} install\` and the project’s test script if available.`);
    }
    if (techStack.testFramework) {
      runActions.push(`Use the existing ${techStack.testFramework} test setup instead of inventing a new test style.`);
    }
    if (techStack.buildTool) {
      runActions.push(`Confirm the ${techStack.buildTool} or build pipeline still passes after each small change.`);
    }
    guide.push({
      title: 'Run the Project Correctly',
      actions: runActions,
    });

    const codebaseActions: string[] = [];
    if (type.includes('Frontend') || techStack.framework === 'React' || techStack.framework === 'Next.js') {
      codebaseActions.push('Trace the user-facing flow from route/page entrypoints into components, hooks, and shared utilities before editing behavior.');
    }
    if (type.includes('Backend') || techStack.framework === 'Express' || techStack.framework === 'Fastify') {
      codebaseActions.push('Trace the request or event flow from handlers into service modules and shared utilities before patching logic.');
    }
    if (type.includes('Library') || type.includes('Package')) {
      codebaseActions.push('Check public exports and package entry files first so you understand the supported surface area before changing internal modules.');
    }
    if (type.includes('Tooling') || structure.directories.some(dir => dir.path.startsWith('tools'))) {
      codebaseActions.push('Inspect CLI/tool entrypoints and the internal engine separately so transport and business logic stay decoupled.');
    }
    codebaseActions.push('Follow existing naming, directory, and test placement conventions instead of introducing a new layout for this issue.');
    guide.push({
      title: 'Trace the Code Path',
      actions: codebaseActions.slice(0, 4),
    });

    guide.push({
      title: 'Scope the Issue Change',
      actions: [
        `Translate "${issue.title}" into one small code path to change first, then expand only if the tests and issue discussion require it.`,
        'Update the nearest existing tests or create a focused regression test next to the implementation area rather than adding broad new coverage first.',
        'Keep a short notes file or PR draft listing assumptions, repo-specific constraints, and any follow-up tasks that should not be bundled into v1.',
      ],
    });

    return guide;
  }

  private recommendStartingPoints(
    issue: IssueInfo,
    issueDeps: {
      directlyAffected: string[];
      indirectlyAffected: string[];
      requiredChanges: string[];
      testFiles: string[];
    }
  ): FileRecommendation[] {
    const recommendations: FileRecommendation[] = [];

    for (const file of issueDeps.directlyAffected.slice(0, 5)) {
      recommendations.push({
        path: file,
        reason: 'Mentioned directly in the issue text or matched strongly against issue keywords.',
        confidence: 'high',
      });
    }

    for (const file of issueDeps.requiredChanges.slice(0, 3)) {
      recommendations.push({
        path: file,
        reason: 'Shared utility or dependency likely to be touched by the issue.',
        confidence: 'medium',
      });
    }

    if (recommendations.length === 0) {
      const ranked = this.rankRepoFilesForIssue(issue).slice(0, 5);
      for (const file of ranked) {
        recommendations.push({
          path: file,
          reason: this.isImplementationCandidate(file)
            ? (this.repoInfo.source === 'remote'
              ? 'Repository file path, naming patterns, and issue keywords suggest this is a likely implementation target.'
              : 'Repository file path and naming patterns align with the issue topic.')
            : 'Repository file path, naming patterns, and issue keywords suggest this is useful context to read before choosing the real edit target.',
          confidence: this.isImplementationCandidate(file) ? 'medium' : 'low',
        });
      }
    }

    if (recommendations.length === 0) {
      for (const entry of this.repoInfo.structure.entryPoints.slice(0, 3)) {
        recommendations.push({
          path: entry,
          reason: 'Likely entry point worth reading first to understand how the project is wired together.',
          confidence: 'low',
        });
      }
    }

    return recommendations
      .filter((item, index, array) => array.findIndex(other => other.path === item.path) === index)
      .sort((a, b) => {
        const aScore = this.isImplementationCandidate(a.path) ? 1 : 0;
        const bScore = this.isImplementationCandidate(b.path) ? 1 : 0;
        return bScore - aScore;
      });
  }

  private rankRepoFilesForIssue(issue: IssueInfo): string[] {
    const text = `${issue.title} ${issue.description} ${issue.requirements.join(' ')} ${issue.acceptanceCriteria.join(' ')} ${(issue.discussionHighlights || []).join(' ')}`.toLowerCase();
    const keywords = Array.from(new Set(text.split(/[^a-z0-9_/-]+/).filter(word => word.length > 3)));

    return this.repoInfo.structure.keyComponents
      .map(component => {
        const lowerPath = component.path.toLowerCase();
        let score = 0;

        for (const keyword of keywords) {
          if (lowerPath.includes(keyword)) {
            score += keyword.length > 7 ? 3 : 2;
          }
        }

        if (/test|spec/.test(lowerPath)) score -= 1;
        if (/src|lib|packages|tools|apps|crates/.test(lowerPath)) score += 1;
        if (/protobuf|proto|archiver|replayer|alerts|event|message|connection|ping|pong|version|verack/.test(lowerPath)) score += 2;
        if (/readme\.md$|\.md$/.test(lowerPath)) score -= 2;
        if (this.isImplementationCandidate(component.path)) score += 2;
        if (this.isContextOnlyFile(component.path)) score -= 1;

        return { path: component.path, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.path);
  }

  private suggestCodeChanges(issue: IssueInfo, startingPoints: FileRecommendation[]): string[] {
    const suggestions: string[] = [];
    const topRequirement = issue.requirements[0] || issue.acceptanceCriteria[0] || issue.title;
    const implementationTargets = startingPoints.filter(point => this.isImplementationCandidate(point.path));
    const contextTargets = startingPoints.filter(point => !this.isImplementationCandidate(point.path));

    if (implementationTargets[0]) {
      if (this.repoInfo.source === 'remote') {
        suggestions.push(`Inspect \`${implementationTargets[0].path}\` first as a likely implementation target for the behavior implied by: ${topRequirement}`);
      } else {
        suggestions.push(`Read and modify \`${implementationTargets[0].path}\` first to implement the core behavior implied by: ${topRequirement}`);
      }
    }

    if (implementationTargets[1]) {
      suggestions.push(`Check \`${implementationTargets[1].path}\` for wiring, exports, or shared helpers that must change alongside the main implementation.`);
    } else if (contextTargets[0]) {
      suggestions.push(`Read \`${contextTargets[0].path}\` as background context before choosing the first real edit target.`);
    }

    const likelyTest = this.findLikelyTestFile(implementationTargets);
    if (likelyTest) {
      suggestions.push(`Add or update regression coverage around \`${likelyTest}\` to lock in the expected behavior for this issue.`);
    } else if (implementationTargets[0]) {
      suggestions.push(`Create a focused test near \`${implementationTargets[0].path}\` that reproduces the issue or validates the new behavior.`);
    }

    if (issue.discussionHighlights && issue.discussionHighlights.length > 0) {
      suggestions.push(`Cross-check your implementation against the issue discussion, especially this guidance: ${issue.discussionHighlights[0]}`);
    }

    return suggestions.slice(0, 5);
  }

  private findLikelyTestFile(startingPoints: FileRecommendation[]): string | undefined {
    for (const point of startingPoints) {
      if (!this.isImplementationCandidate(point.path)) {
        continue;
      }
      const candidate = this.findVerifiedTestTarget(undefined, point.path);
      if (candidate && candidate !== point.path) {
        return candidate;
      }
    }

    return undefined;
  }

  private findVerifiedTestTarget(preferredPath?: string, sourceFile?: string): string | undefined {
    const candidates = [preferredPath, sourceFile ? this.deriveTestTarget(sourceFile) : undefined].filter(Boolean) as string[];
    const lowerSource = (sourceFile || preferredPath || '').toLowerCase();
    const repoTests = this.repoInfo.structure.keyComponents
      .map(component => component.path)
      .filter(componentPath => /(^|\/)(tests?|__tests__)\/|(\.test\.|\.spec\.)/.test(componentPath.toLowerCase()));

    for (const candidate of candidates) {
      if (repoTests.includes(candidate)) {
        return candidate;
      }
    }

    const sourceBase = path.basename(sourceFile || preferredPath || '').replace(/\.[^.]+$/, '').toLowerCase();
    const siblingMatch = repoTests.find(testPath => sourceBase && testPath.toLowerCase().includes(sourceBase));
    if (siblingMatch) {
      return siblingMatch;
    }

    const domainMatch = repoTests.find(testPath => {
      const lower = testPath.toLowerCase();
      return /(agent|simulation|conversation|state|message|contract)/.test(lowerSource)
        && /(agent|simulation|conversation|state|message|contract)/.test(lower);
    });
    if (domainMatch) {
      return domainMatch;
    }

    return this.isLikelyTestFile(candidates[0]) ? candidates[0] : undefined;
  }

  private deriveTestTarget(file: string): string {
    if (file.includes('.test.') || file.includes('.spec.')) {
      return file;
    }

    if (/\.(ts|tsx|js|jsx)$/.test(file)) {
      return file.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1');
    }

    if (file.endsWith('.rs')) {
      const directMatch = this.repoInfo.structure.keyComponents.find(component =>
        component.type === 'test' && component.path.includes(path.basename(file, '.rs'))
      );
      if (directMatch) {
        return directMatch.path;
      }

      if (file.includes('/src/')) {
        const parts = file.split('/');
        const packageName = parts.length >= 3 ? parts[parts.length - 3] : path.basename(file, '.rs');
        return file.replace('/src/', '/tests/').replace(/(?:main|lib)\.rs$/, `${packageName}.rs`);
      }
    }

    if (file.endsWith('.go')) {
      return file.replace(/\.go$/, '_test.go');
    }

    if (file.endsWith('.py')) {
      const base = path.basename(file, '.py');
      return file.replace(new RegExp(`${base}\\.py$`), `test_${base}.py`);
    }

    return file;
  }

  private isImplementationCandidate(file: string): boolean {
    const lower = file.toLowerCase();
    if (this.isLikelyTestFile(file) || this.isContextOnlyFile(file)) {
      return false;
    }

    return /\.(rs|ts|tsx|js|jsx|go|py|java|kt|swift|rb|c|cc|cpp|h|hpp)$/.test(lower);
  }

  private isContextOnlyFile(file: string): boolean {
    const lower = file.toLowerCase();
    return /readme\.md$|\.md$|\.proto$|schema|openapi|swagger|docs?\//.test(lower);
  }

  private isLikelyTestFile(file?: string): boolean {
    if (!file) return false;
    const lower = file.toLowerCase();
    return /(^|\/)(tests?|__tests__)\/|(\.test\.|\.spec\.)|_test\./.test(lower);
  }

  private canGenerateImplementationPreview(file: string): boolean {
    return this.isImplementationCandidate(file);
  }

  private getInitialInvestigationTargets(issue: IssueInfo): string[] {
    return this.rankRepoFilesForIssue(issue).slice(0, 5);
  }

  private getCandidateTestTargets(candidateFiles: string[]): string[] {
    return candidateFiles
      .map(file => this.deriveTestTarget(file))
      .filter((file, index, array) => file !== candidateFiles[index] && array.indexOf(file) === index);
  }

  private identifyOpenQuestions(
    issue: IssueInfo,
    issueDeps: {
      directlyAffected: string[];
      indirectlyAffected: string[];
      requiredChanges: string[];
      testFiles: string[];
    }
  ): string[] {
    const questions: string[] = [];

    if (issueDeps.directlyAffected.length === 0) {
      questions.push('Which modules or directories are intended to own the first milestone of this issue?');
    }

    if (issue.acceptanceCriteria.length === 0) {
      questions.push('What concrete success conditions would let a maintainer accept the first implementation?');
    }

    if (issue.relatedIssues.length === 0) {
      questions.push('Are there linked issues, prior attempts, or existing tools that already cover part of this work?');
    }

    if (issue.type === 'feature' || issue.type === 'enhancement') {
      questions.push('What work should be explicitly deferred from v1 so the first contribution stays narrowly reviewable?');
    }

    return questions;
  }

  /**
   * Create rollback strategy
   */
  private createRollbackStrategy(
    issue: IssueInfo,
    issueDeps: {
      directlyAffected: string[];
      indirectlyAffected: string[];
      requiredChanges: string[];
      testFiles: string[];
    }
  ): string[] {
    const strategy: string[] = [];

    strategy.push('Keep the feature branch until changes are verified in production');
    strategy.push('Tag the commit before merging for easy revert');

    if (issueDeps.directlyAffected.length > 3) {
      strategy.push('Consider feature flags for gradual rollout');
      strategy.push('Have a rollback plan ready before deployment');
    }

    if (issue.complexity === 'critical' || issue.complexity === 'high') {
      strategy.push('Deploy to staging environment first');
      strategy.push('Monitor key metrics after deployment');
      strategy.push('Have database backup if schema changes involved');
    }

    strategy.push('Document rollback procedure in PR description');

    return strategy;
  }

  /**
   * Generate plan summary
   */
  generateSummary(plan: ImplementationPlan): string {
    const lines: string[] = [];

    lines.push(`# Implementation Plan: ${plan.issue.title}`);
    lines.push('');
    lines.push(`**Issue Type:** ${plan.issue.type}`);
    lines.push(`**Complexity:** ${plan.issue.complexity}`);
    lines.push(`**Estimated Time:** ${plan.estimatedHours} hours`);
    lines.push('');

    if (plan.warnings.length > 0) {
      lines.push('## Warnings');
      plan.warnings.forEach(warning => lines.push(`- ${warning}`));
      lines.push('');
    }

    if (plan.projectOverview.length > 0) {
      lines.push('## Project Overview');
      plan.projectOverview.forEach(item => lines.push(`- ${item}`));
      lines.push('');
    }

    if (plan.projectActionGuide.length > 0) {
      lines.push('## Project Action Guide');
      for (const section of plan.projectActionGuide) {
        lines.push(`### ${section.title}`);
        section.actions.forEach(action => lines.push(`- ${action}`));
        lines.push('');
      }
    }

    if (plan.recommendedStartingPoints.length > 0) {
      lines.push('## Recommended Starting Files');
      for (const item of plan.recommendedStartingPoints) {
        lines.push(`- **${item.path}** (${item.confidence})`);
        lines.push(`  Reason: ${item.reason}`);
      }
      lines.push('');
    }

    if (plan.suggestedCodeChanges.length > 0) {
      lines.push('## Suggested Code Changes');
      plan.suggestedCodeChanges.forEach(change => lines.push(`- ${change}`));
      lines.push('');
    }

    // Prerequisites
    if (plan.prerequisites.length > 0) {
      lines.push('## Prerequisites');
      plan.prerequisites.forEach(p => lines.push(`- ${p}`));
      lines.push('');
    }

    // Implementation Steps
    lines.push('## Implementation Steps');
    for (const step of plan.steps) {
      lines.push(`### ${step.number}. ${step.title}`);
      lines.push(`*Estimated time: ${step.estimatedMinutes} minutes*`);
      lines.push('');
      lines.push(step.description);
      lines.push('');
      lines.push('**Actions:**');
      step.actions.forEach(action => lines.push(`- ${action}`));
      lines.push('');
      if (step.files.length > 0) {
        lines.push('**Files:**');
        step.files.forEach(file => lines.push(`- ${file}`));
        lines.push('');
      }
      lines.push('**Validation:**');
      step.validationCriteria.forEach(criteria => lines.push(`- [ ] ${criteria}`));
      lines.push('');
    }

    // Test Strategy
    lines.push('## Test Strategy');
    lines.push(`**Coverage Target:** ${plan.testStrategy.coverageTarget}%`);
    lines.push('');
    if (plan.testStrategy.unitTests.length > 0) {
      lines.push('**Unit Tests:**');
      plan.testStrategy.unitTests.forEach(test => lines.push(`- ${test}`));
      lines.push('');
    }
    if (plan.testStrategy.integrationTests.length > 0) {
      lines.push('**Integration Tests:**');
      plan.testStrategy.integrationTests.forEach(test => lines.push(`- ${test}`));
      lines.push('');
    }

    // Risks
    if (plan.risks.length > 0) {
      lines.push('## Risk Assessment');
      for (const risk of plan.risks) {
        lines.push(`### ${risk.level.toUpperCase()}: ${risk.description}`);
        lines.push(`**Impact:** ${risk.impact}`);
        lines.push('**Mitigation:**');
        risk.mitigation.forEach(m => lines.push(`- ${m}`));
        lines.push('');
      }
    }

    if (plan.openQuestions.length > 0) {
      lines.push('## Open Questions');
      plan.openQuestions.forEach(question => lines.push(`- ${question}`));
      lines.push('');
    }

    // Review Points
    lines.push('## Review Points');
    plan.reviewPoints.forEach(point => lines.push(`- ${point}`));
    lines.push('');

    // Rollback Strategy
    lines.push('## Rollback Strategy');
    plan.rollbackStrategy.forEach(step => lines.push(`- ${step}`));

    return lines.join('\n');
  }
}
