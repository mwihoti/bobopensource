import { logger } from '../utils/logger';
import {
  IssueInfo,
  IssueType,
  Complexity,
  RepositoryInfo,
} from '../types';
import { GitHubClient } from '../utils/github';

export class IssueAnalyzer {
  private repoInfo?: RepositoryInfo;
  private githubClient: GitHubClient;

  constructor(repoInfo?: RepositoryInfo) {
    this.repoInfo = repoInfo;
    this.githubClient = new GitHubClient();
  }

  /**
   * Analyze a GitHub issue
   */
  async analyzeIssue(issueUrl: string): Promise<IssueInfo> {
    logger.progress('Analyzing issue');

    const { owner, repo, number } = this.parseIssueUrl(issueUrl);
    const issueData = await this.fetchIssueData(owner, repo, number);
    const discussionHighlights = await this.fetchDiscussionHighlights(owner, repo, number);
    const body = issueData.body?.trim() || '';
    const labels = issueData.labels ?? [];

    const type = this.detectIssueType(issueData.title, body, labels);
    const complexity = this.assessComplexity(body, labels);
    const affectedComponents = this.identifyAffectedComponents(body);
    const requirements = this.extractRequirements(body);
    const acceptanceCriteria = this.extractAcceptanceCriteria(body);
    const relatedIssues = this.extractRelatedIssues(body);

    logger.success('Issue analysis complete');

    return {
      url: issueUrl,
      owner,
      repo,
      number,
      title: issueData.title,
      description: body,
      labels,
      state: issueData.state,
      author: issueData.user?.login,
      createdAt: issueData.created_at,
      updatedAt: issueData.updated_at,
      source: 'github-api',
      discussionHighlights,
      type,
      complexity,
      affectedComponents,
      requirements,
      acceptanceCriteria,
      relatedIssues,
    };
  }

  /**
   * Parse GitHub issue URL
   */
  private parseIssueUrl(url: string): { owner: string; repo: string; number: number } {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);

    if (!match) {
      throw new Error('Invalid GitHub issue URL');
    }

    return {
      owner: match[1],
      repo: match[2],
      number: parseInt(match[3], 10),
    };
  }

  /**
   * Fetch issue data from GitHub API
   */
  private async fetchIssueData(
    owner: string,
    repo: string,
    number: number
  ): Promise<{
    title: string;
    body: string;
    state: string;
    user?: { login?: string };
    labels: string[];
    created_at?: string;
    updated_at?: string;
  }> {
    const response = await this.githubClient.getIssue(owner, repo, number);

    return {
      ...response,
      body: response.body ?? '',
      labels: (response.labels ?? [])
        .map(label => label.name?.trim())
        .filter((label): label is string => Boolean(label)),
    };
  }

  private async fetchDiscussionHighlights(owner: string, repo: string, number: number): Promise<string[]> {
    try {
      const comments = await this.githubClient.getIssueComments(owner, repo, number);
      return comments
        .map(comment => comment.body?.trim())
        .filter((body): body is string => Boolean(body))
        .filter(body => body.length > 40)
        .slice(0, 3);
    } catch {
      return [];
    }
  }

  /**
   * Detect issue type from title, body, and labels
   */
  private detectIssueType(title: string, body: string, labels: string[]): IssueType {
    const combined = `${title} ${body} ${labels.join(' ')}`.toLowerCase();

    if (combined.match(/\b(bug|error|crash|broken|fix|issue)\b/)) {
      return 'bug';
    }
    if (combined.match(/\b(feature|add|new|implement|support)\b/)) {
      return 'feature';
    }
    if (combined.match(/\b(enhance|improve|optimize|update|upgrade)\b/)) {
      return 'enhancement';
    }
    if (combined.match(/\b(doc|documentation|readme|guide)\b/)) {
      return 'documentation';
    }
    if (combined.match(/\b(refactor|cleanup|reorganize|restructure)\b/)) {
      return 'refactor';
    }

    return 'feature';
  }

  /**
   * Assess issue complexity
   */
  private assessComplexity(body: string, labels: string[]): Complexity {
    let score = 0;
    const complexityLabels = labels.map(l => l.toLowerCase());

    if (complexityLabels.includes('critical') || complexityLabels.includes('high priority')) {
      return 'critical';
    }
    if (complexityLabels.includes('easy') || complexityLabels.includes('good first issue')) {
      return 'low';
    }

    const bodyLower = body.toLowerCase();

    if (bodyLower.includes('architecture') || bodyLower.includes('breaking change')) score += 3;
    if (bodyLower.includes('multiple files') || bodyLower.includes('several components')) score += 2;
    if (bodyLower.includes('database') || bodyLower.includes('migration')) score += 2;
    if (bodyLower.includes('security') || bodyLower.includes('authentication')) score += 2;
    if (bodyLower.includes('performance') || bodyLower.includes('optimization')) score += 1;
    if (bodyLower.includes('vague') || bodyLower.includes('explore') || bodyLower.includes('investigate')) score += 1;

    if (bodyLower.includes('typo') || bodyLower.includes('documentation')) score -= 2;
    if (bodyLower.includes('simple') || bodyLower.includes('straightforward')) score -= 1;

    const wordCount = body.split(/\s+/).filter(Boolean).length;
    if (wordCount > 500) score += 2;
    else if (wordCount < 100) score -= 1;

    if (score >= 5) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  /**
   * Identify affected components from issue description
   */
  private identifyAffectedComponents(body: string): string[] {
    if (!body.trim()) {
      return [];
    }

    const components = new Set<string>();

    // Prioritize explicit file paths and backticked identifiers.
    const filePathRegex = /`([^`\n]+\.[a-zA-Z0-9]+)`|(?:^|\s)([a-zA-Z0-9._-]+\/[a-zA-Z0-9._/-]+\.[a-zA-Z0-9]+)(?=\s|$)/gm;
    let match: RegExpExecArray | null;
    while ((match = filePathRegex.exec(body)) !== null) {
      components.add((match[1] || match[2]).trim());
    }

    if (!this.repoInfo) {
      return Array.from(components);
    }

    const normalizedBody = this.normalizeForWordSearch(body);
    for (const component of this.repoInfo.structure.keyComponents) {
      const componentName = component.path.split('/').pop()?.replace(/\.[^.]+$/, '');
      if (!componentName || componentName.length < 4) {
        continue;
      }

      if (this.containsWholeWord(normalizedBody, this.normalizeForWordSearch(componentName))) {
        components.add(component.path);
      }
    }

    return Array.from(components);
  }

  private normalizeForWordSearch(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9/_-]+/g, ' ')
      .trim();
  }

  private containsWholeWord(haystack: string, needle: string): boolean {
    if (!needle) {
      return false;
    }

    const pattern = new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i');
    return pattern.test(haystack);
  }

  /**
   * Extract requirements from issue body
   */
  private extractRequirements(body: string): string[] {
    const requirements: string[] = [];

    const numberedListRegex = /^\s*\d+\.\s+(.+)$/gm;
    let match: RegExpExecArray | null;
    while ((match = numberedListRegex.exec(body)) !== null) {
      requirements.push(match[1].trim());
    }

    const bulletRegex = /^\s*[-*]\s+(.+)$/gm;
    while ((match = bulletRegex.exec(body)) !== null) {
      const item = match[1].trim();
      if (!item.startsWith('[') && item.length > 10) {
        requirements.push(item);
      }
    }

    const shouldRegex = /(?:should|must|need to|required to)\s+([^.!?]+)/gi;
    while ((match = shouldRegex.exec(body)) !== null) {
      const requirement = match[0].trim();
      if (requirement.length > 15 && requirement.length < 200) {
        requirements.push(requirement);
      }
    }

    return [...new Set(requirements)].slice(0, 10);
  }

  /**
   * Extract acceptance criteria
   */
  private extractAcceptanceCriteria(body: string): string[] {
    const criteria: string[] = [];

    const acSectionRegex = /(?:acceptance criteria|definition of done|success criteria)[:\s]*\n((?:[-*]\s+.+\n?)+)/gi;
    const match = acSectionRegex.exec(body);

    if (match) {
      const section = match[1];
      const items = section.match(/[-*]\s+(.+)/g);
      if (items) {
        criteria.push(...items.map(item => item.replace(/^[-*]\s+/, '').trim()));
      }
    }

    const checkboxRegex = /^\s*-\s*\[\s*\]\s+(.+)$/gm;
    let checkMatch: RegExpExecArray | null;
    while ((checkMatch = checkboxRegex.exec(body)) !== null) {
      criteria.push(checkMatch[1].trim());
    }

    return [...new Set(criteria)];
  }

  /**
   * Extract related issues
   */
  private extractRelatedIssues(body: string): number[] {
    const issues: number[] = [];

    const issueRefRegex = /#(\d+)/g;
    let match: RegExpExecArray | null;
    while ((match = issueRefRegex.exec(body)) !== null) {
      issues.push(parseInt(match[1], 10));
    }

    const urlRegex = /github\.com\/[^/]+\/[^/]+\/issues\/(\d+)/g;
    while ((match = urlRegex.exec(body)) !== null) {
      issues.push(parseInt(match[1], 10));
    }

    return [...new Set(issues)];
  }

  /**
   * Suggest relevant files to review
   */
  suggestFilesToReview(issue: IssueInfo): string[] {
    const suggestions: string[] = [];

    if (!this.repoInfo) {
      return suggestions;
    }

    suggestions.push(...issue.affectedComponents);

    for (const component of issue.affectedComponents) {
      const testFile = component.replace(/\.(ts|js|tsx|jsx)$/, '.test.$1');
      suggestions.push(testFile);
    }

    for (const component of this.repoInfo.structure.keyComponents) {
      if (issue.affectedComponents.some(affected =>
        component.dependencies.includes(affected) ||
        component.path.includes(affected)
      )) {
        suggestions.push(component.path);
      }
    }

    return [...new Set(suggestions)].slice(0, 15);
  }

  /**
   * Generate issue summary
   */
  generateSummary(issue: IssueInfo): string {
    const lines: string[] = [];

    lines.push(`Issue #${issue.number}: ${issue.title}`);
    lines.push(`Repo: ${issue.owner}/${issue.repo}`);
    lines.push(`Type: ${issue.type} | Complexity: ${issue.complexity}`);
    if (issue.labels.length > 0) {
      lines.push(`Labels: ${issue.labels.join(', ')}`);
    }
    lines.push('');

    if (issue.affectedComponents.length > 0) {
      lines.push('Affected Components:');
      issue.affectedComponents.forEach(comp => lines.push(`  - ${comp}`));
      lines.push('');
    }

    if (issue.requirements.length > 0) {
      lines.push('Requirements:');
      issue.requirements.slice(0, 5).forEach((req, i) => lines.push(`  ${i + 1}. ${req}`));
      lines.push('');
    }

    if (issue.acceptanceCriteria.length > 0) {
      lines.push('Acceptance Criteria:');
      issue.acceptanceCriteria.forEach(ac => lines.push(`  ✓ ${ac}`));
      lines.push('');
    }

    if (issue.relatedIssues.length > 0) {
      lines.push(`Related Issues: ${issue.relatedIssues.map(i => `#${i}`).join(', ')}`);
    }

    return lines.join('\n');
  }
}
