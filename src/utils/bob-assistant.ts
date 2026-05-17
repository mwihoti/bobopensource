import { ImplementationPlan, IssueInfo, RepositoryInfo, StepResource } from '../types';

export interface BobChatContext {
  issueInfo: IssueInfo;
  repoInfo: RepositoryInfo;
  plan: ImplementationPlan;
  extraFileContexts?: Record<string, string>;
}

export interface BobChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface BobChatResponse {
  answer: string;
  followUps: string[];
  evidence: string[];
}

type IndexedResource = StepResource & {
  stepTitle: string;
};

export class BobAssistant {
  static answer(question: string, context: BobChatContext, history: BobChatMessage[] = []): BobChatResponse {
    const current = question.trim();
    const normalized = current.toLowerCase();
    const historyText = history.slice(-4).map(item => item.content).join(' ').toLowerCase();
    const { issueInfo, repoInfo, plan } = context;
    const startFiles = plan.recommendedStartingPoints.slice(0, 5);
    const resources = this.collectResources(plan);
    const readmeResource = resources.find(resource => resource.title === 'README Context');
    const traceGuide = plan.projectActionGuide.find(section => /trace/i.test(section.title));
    const runGuide = plan.projectActionGuide.find(section => /run/i.test(section.title));
    const docStep = plan.steps.find(step => step.title === 'Update Documentation');
    const firstImplementationStep = plan.steps.find(step => step.title.includes('Implement Changes') || step.title === 'Implement the MVP Slice');
    const branchResource = plan.steps[0]?.resources?.find(resource => resource.title === 'Create Branch');
    const fileQuery = this.extractFilePath(current);
    const matchedFile = fileQuery ? this.matchFileQuery(fileQuery, startFiles, resources) : undefined;
    const extraFileContexts = context.extraFileContexts || {};

    if (this.isProjectOverviewQuestion(normalized)) {
      return this.answerProjectOverview(repoInfo, plan, readmeResource);
    }

    if (fileQuery && this.isCodeRequest(normalized)) {
      return this.answerCodeForFile(fileQuery, matchedFile, resources, extraFileContexts);
    }

    if (fileQuery) {
      return this.answerFileQuestion(fileQuery, matchedFile, startFiles, resources, extraFileContexts);
    }

    if (/(where.*start|start.*file|which file|first file|begin)/.test(normalized)) {
      return {
        answer: startFiles.length > 0
          ? `Start with \`${startFiles[0].path}\`. After that, inspect ${startFiles.slice(1, 3).map(file => `\`${file.path}\``).join(' and ')} to confirm the wiring around the first change.`
          : 'Start with the project overview and the first implementation step, then trace the owning code path before editing.',
        followUps: [
          'Why is that file the best starting point?',
          'What code path should I trace first?',
        ],
        evidence: startFiles.slice(0, 3).map(file => `${file.path}: ${file.reason}`),
      };
    }

    if (/(trace|call path|flow|which function|which method|owner)/.test(normalized)) {
      const hintResource = this.findImplementationResource(resources, 'Code Path Hints');
      return {
        answer: hintResource
          ? `Trace this code path first:\n${hintResource.content.split('\n').map(line => `- ${line}`).join('\n')}`
          : traceGuide
            ? `Trace the code path this way:\n${traceGuide.actions.map(action => `- ${action}`).join('\n')}`
            : `Trace from \`${startFiles[0]?.path || 'the first recommended file'}\` into the nearest exported function, then inspect its callers and adjacent dependencies before patching logic.`,
        followUps: [
          'Show me the current code for that file',
          'Where should I add the first test?',
        ],
        evidence: hintResource
          ? hintResource.content.split('\n').slice(0, 4)
          : [
              ...(traceGuide?.actions || []),
              ...(firstImplementationStep?.files || []).slice(0, 3),
            ],
      };
    }

    if (/(branch|git checkout|feature branch)/.test(normalized)) {
      return {
        answer: branchResource?.content
          ? `Use this branch command first:\n\n\`${branchResource.content}\``
          : `Create a feature branch named after issue #${issueInfo.number} before changing code.`,
        followUps: [
          'What should I read before coding?',
          'What should go in the PR description?',
        ],
        evidence: branchResource ? ['Setup step generated a branch command from the issue title.'] : [`Issue number: #${issueInfo.number}`],
      };
    }

    if (/(test|verify|validation|regression)/.test(normalized)) {
      const testStep = plan.steps.find(step => step.title.includes('Test'));
      const testResource = resources.find(resource => resource.title === 'Suggested Test Scaffold');
      return {
        answer: `Test the first implementation change with a focused regression test, then run the smallest manual or integration check that proves the behavior end-to-end.${testResource?.path ? ` Bob’s best current test target is \`${testResource.path}\`.` : ''}`,
        followUps: [
          'Show me the suggested test scaffold',
          'What manual check should I run after the tests pass?',
        ],
        evidence: [
          ...(testStep?.actions || []).slice(0, 3),
          ...(testResource?.path ? [`Suggested test file: ${testResource.path}`] : []),
        ],
      };
    }

    if (/(risk|danger|break|side effect|impact)/.test(normalized)) {
      return {
        answer: `Risk: ${plan.riskSummary.level}. ${plan.riskSummary.reason}`,
        followUps: [
          'How do I keep the first patch small?',
          'Which files are most likely to be affected indirectly?',
        ],
        evidence: [
          plan.riskSummary.reason,
          ...(plan.risks || []).slice(0, 2).map(risk => `${risk.level}: ${risk.description}`),
        ],
      };
    }

    if (/(pr|pull request|draft)/.test(normalized)) {
      return {
        answer: `Use this PR draft.\n\nTitle: ${plan.prDraft.title}\n\nSummary:\n${plan.prDraft.summary.map(item => `- ${item}`).join('\n')}\n\nTests:\n${plan.prDraft.tests.map(item => `- ${item}`).join('\n')}`,
        followUps: [
          'What validation steps should I include in the PR?',
          'Do I need README changes for this issue?',
        ],
        evidence: [
          `PR title derived from the issue objective: ${issueInfo.title}`,
          ...plan.prDraft.summary,
        ],
      };
    }

    if (/(readme|docs|documentation)/.test(normalized)) {
      return {
        answer: docStep
          ? 'Only update documentation if the behavior change is user-facing or developer-facing. If the change is internal-only, keep the explanation close to the code and avoid README churn.'
          : 'No separate documentation step was identified for this issue, so keep comments local unless the change affects public behavior.',
        followUps: [
          'Show me the README context Bob used',
          'Do I need README changes for this issue?',
        ],
        evidence: docStep?.actions || ['Documentation should match the actual behavior change, not expand repo docs unnecessarily.'],
      };
    }

    if (/(run|command|install|dev|lint|typecheck)/.test(normalized)) {
      return {
        answer: runGuide
          ? `Use the repo-specific run guidance Bob extracted:\n${runGuide.actions.map(action => `- ${action}`).join('\n')}`
          : 'Run the repo baseline before editing, then rerun the narrowest relevant test command after each change.',
        followUps: [
          'What should I verify after the command succeeds?',
          'Which code path is most likely affected?',
        ],
        evidence: runGuide?.actions || [`Package manager: ${repoInfo.techStack.packageManager}`],
      };
    }

    if (/(read|show|summary|context)/.test(normalized) && /readme/.test(normalized)) {
      return this.answerReadmeContext(readmeResource, repoInfo, plan);
    }

    return {
      answer: this.buildFallbackAnswer(current, historyText, issueInfo, repoInfo, plan, startFiles),
      followUps: [
        'What does this project do?',
        'Which file should I change first?',
        'Show me the current code for the first file',
      ],
      evidence: [
        `Project: ${repoInfo.name}`,
        `Issue objective: ${issueInfo.requirements[0] || issueInfo.title}`,
        `Suggested files: ${startFiles.slice(0, 3).map(file => file.path).join(', ') || 'none identified'}`,
      ],
    };
  }

  private static isProjectOverviewQuestion(normalized: string): boolean {
    return /(what does .*project do|what is .*project about|what does this do|what is this project about|project overview|what does the project do)/.test(normalized);
  }

  private static isCodeRequest(normalized: string): boolean {
    return /(code for|show code|current code|content of|what is in|file content|excerpt)/.test(normalized);
  }

  private static answerProjectOverview(
    repoInfo: RepositoryInfo,
    plan: ImplementationPlan,
    readmeResource?: IndexedResource
  ): BobChatResponse {
    const overviewLines = plan.projectOverview.slice(0, 4);
    const readmeExcerpt = readmeResource?.content.split('\n').slice(0, 8).join('\n');

    return {
      answer: overviewLines.length > 0
        ? `This project is ${overviewLines[0].charAt(0).toLowerCase() + overviewLines[0].slice(1)}\n\nWhat Bob inferred:\n${overviewLines.map(line => `- ${line}`).join('\n')}`
        : `${repoInfo.name} is a ${repoInfo.type} project built with ${[repoInfo.techStack.language, repoInfo.techStack.framework].filter(Boolean).join(' and ')}.`,
      followUps: [
        'What part of the project matters most for this issue?',
        'Show me the README context Bob used',
      ],
      evidence: [
        ...(repoInfo.highlights || []).slice(0, 3),
        ...(readmeExcerpt ? [`README excerpt:\n${readmeExcerpt}`] : []),
      ],
    };
  }

  private static answerReadmeContext(
    readmeResource: IndexedResource | undefined,
    repoInfo: RepositoryInfo,
    plan: ImplementationPlan
  ): BobChatResponse {
    if (!readmeResource) {
      return {
        answer: `Bob did not capture a README excerpt for this repo, but the project overview says:\n${plan.projectOverview.map(line => `- ${line}`).join('\n')}`,
        followUps: [
          'What does this project do?',
          'Which file should I inspect first?',
        ],
        evidence: plan.projectOverview.slice(0, 4),
      };
    }

    return {
      answer: `Here is the README context Bob used:\n\n${readmeResource.content}`,
      followUps: [
        'What part of this matters most for the issue?',
        'Which file should I inspect first?',
      ],
      evidence: [
        `Repository: ${repoInfo.name}`,
        `README surfaced from step: ${readmeResource.stepTitle}`,
      ],
    };
  }

  private static answerFileQuestion(
    fileQuery: string,
    matchedFile: { path: string; reason?: string; resource?: IndexedResource } | undefined,
    startFiles: ImplementationPlan['recommendedStartingPoints'],
    resources: IndexedResource[],
    extraFileContexts: Record<string, string>
  ): BobChatResponse {
    if (!matchedFile) {
      return {
        answer: `Bob does not have a strong match for \`${fileQuery}\` in the current analysis context. Ask for one of the suggested files or rerun analysis with a local checkout for deeper file coverage.`,
        followUps: [
          'Which file should I change first?',
          'What does this project do?',
        ],
        evidence: startFiles.slice(0, 3).map(file => `${file.path}: ${file.reason}`),
      };
    }

    const codeResource = resources.find(resource => resource.path === matchedFile.path && resource.title.startsWith('Current Code:'));
    const pathHints = resources.find(resource => resource.path === matchedFile.path && resource.title === 'Code Path Hints');
    const insertion = resources.find(resource => resource.path === matchedFile.path && resource.title === 'Insertion Point Detection');
    const extraContext = this.findExtraFileContext(matchedFile.path, extraFileContexts);

    return {
      answer: `\`${matchedFile.path}\` is relevant because ${matchedFile.reason || 'Bob matched it from the generated plan context.'}${pathHints ? `\n\nTrace it this way:\n${pathHints.content.split('\n').map(line => `- ${line}`).join('\n')}` : ''}${insertion ? `\n\nCurrent insertion guidance:\n${insertion.content}` : ''}${extraContext ? `\n\nOn-demand code context:\n${extraContext}` : ''}`,
      followUps: [
        `Show me the code for ${matchedFile.path}`,
        'What should I test after changing this file?',
      ],
      evidence: [
        ...(matchedFile.reason ? [matchedFile.reason] : []),
        ...(codeResource?.description ? [codeResource.description] : []),
        ...(extraContext ? ['Bob fetched this file on demand because it was not already indexed in the plan resources.'] : []),
        ...(pathHints ? pathHints.content.split('\n').slice(0, 3) : []),
      ],
    };
  }

  private static answerCodeForFile(
    fileQuery: string,
    matchedFile: { path: string; reason?: string; resource?: IndexedResource } | undefined,
    resources: IndexedResource[],
    extraFileContexts: Record<string, string>
  ): BobChatResponse {
    if (!matchedFile) {
      const fallbackExtra = this.findExtraFileContext(fileQuery, extraFileContexts);
      if (fallbackExtra) {
        return {
          answer: `Here is the on-demand code context Bob fetched for \`${fileQuery}\`:\n\n${fallbackExtra}`,
          followUps: [
            `Why is ${fileQuery} relevant?`,
            'What code path should I trace first?',
          ],
          evidence: ['Bob fetched this file on demand because it was not already indexed in the plan resources.'],
        };
      }

      return {
        answer: `Bob does not have a code excerpt for \`${fileQuery}\` in the current analysis context.`,
        followUps: [
          'Which suggested file should I inspect first?',
          'What code path should I trace first?',
        ],
        evidence: [],
      };
    }

    const codeResource = resources.find(resource => resource.path === matchedFile.path && resource.title.startsWith('Current Code:'));
    const extraContext = this.findExtraFileContext(matchedFile.path, extraFileContexts);
    if (!codeResource) {
      if (extraContext) {
        return {
          answer: `Here is the on-demand code context Bob fetched for \`${matchedFile.path}\`:\n\n${extraContext}`,
          followUps: [
            'What should I change in this file first?',
            'What should I test after changing this file?',
          ],
          evidence: [
            'Bob fetched this file on demand because it was not already indexed in the plan resources.',
            ...(matchedFile.reason ? [matchedFile.reason] : []),
          ],
        };
      }

      return {
        answer: `Bob identified \`${matchedFile.path}\` as relevant, but does not have a stored code excerpt for it in the current analysis result.`,
        followUps: [
          `Why is ${matchedFile.path} relevant?`,
          'What code path should I trace first?',
        ],
        evidence: matchedFile.reason ? [matchedFile.reason] : [],
      };
    }

    return {
      answer: `Here is the current code context Bob captured for \`${matchedFile.path}\`:\n\n${codeResource.content}`,
      followUps: [
        'What should I change in this file first?',
        'What should I test after changing this file?',
      ],
      evidence: [
        codeResource.description || 'Current code excerpt captured during plan enrichment.',
        ...(matchedFile.reason ? [matchedFile.reason] : []),
      ],
    };
  }

  private static buildFallbackAnswer(
    current: string,
    historyText: string,
    issueInfo: IssueInfo,
    repoInfo: RepositoryInfo,
    plan: ImplementationPlan,
    startFiles: ImplementationPlan['recommendedStartingPoints']
  ): string {
    if (historyText.includes('project') && /(what|which|show|explain)/.test(current.toLowerCase())) {
      return `Bob understands the project as ${repoInfo.type.toLowerCase()} work around "${issueInfo.requirements[0] || issueInfo.title}". Ask about the project overview, a specific file, the code path, tests, documentation, risk, or the PR draft and Bob will answer from the generated analysis.`;
    }

    return `Bob’s current recommendation for issue #${issueInfo.number} is to start with ${startFiles[0] ? `\`${startFiles[0].path}\`` : 'the first implementation step'}, keep the first patch narrow, and validate it with a focused regression test before broadening the change. If you ask about the project overview, a specific file path, code excerpts, tests, commands, docs, or the PR draft, Bob can answer with project-specific guidance.`;
  }

  private static collectResources(plan: ImplementationPlan): IndexedResource[] {
    return plan.steps.flatMap(step =>
      (step.resources || []).map(resource => ({
        ...resource,
        stepTitle: step.title,
      }))
    );
  }

  private static findImplementationResource(resources: IndexedResource[], title: string): IndexedResource | undefined {
    return resources.find(resource => resource.title === title);
  }

  private static extractFilePath(question: string): string | undefined {
    const explicitMatch = question.match(/([A-Za-z0-9_./-]+\.(?:rs|ts|tsx|js|jsx|go|py|proto|md|toml|yaml|yml))/);
    return explicitMatch?.[1];
  }

  private static matchFileQuery(
    fileQuery: string,
    startFiles: ImplementationPlan['recommendedStartingPoints'],
    resources: IndexedResource[]
  ): { path: string; reason?: string; resource?: IndexedResource } | undefined {
    const normalizedQuery = fileQuery.replace(/^\.?\//, '').toLowerCase();
    const startMatch = startFiles.find(file => {
      const candidate = file.path.toLowerCase();
      return candidate === normalizedQuery || candidate.endsWith(normalizedQuery) || normalizedQuery.endsWith(candidate);
    });

    if (startMatch) {
      return { path: startMatch.path, reason: startMatch.reason };
    }

    const resourceMatch = resources.find(resource => {
      const candidate = (resource.path || '').toLowerCase();
      return candidate === normalizedQuery || candidate.endsWith(normalizedQuery) || normalizedQuery.endsWith(candidate);
    });

    if (resourceMatch?.path) {
      return { path: resourceMatch.path, resource: resourceMatch };
    }

    return undefined;
  }

  private static findExtraFileContext(fileQuery: string, extraFileContexts: Record<string, string>): string | undefined {
    const normalizedQuery = fileQuery.replace(/^\.?\//, '').toLowerCase();
    const entry = Object.entries(extraFileContexts).find(([key]) => {
      const normalizedKey = key.replace(/^\.?\//, '').toLowerCase();
      return normalizedKey === normalizedQuery
        || normalizedKey.endsWith(normalizedQuery)
        || normalizedQuery.endsWith(normalizedKey);
    });

    return entry?.[1];
  }
}
