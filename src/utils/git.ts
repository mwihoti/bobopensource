import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs';

export class GitUtils {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  /**
   * Check if directory is a git repository
   */
  static async isGitRepository(dirPath: string): Promise<boolean> {
    try {
      const git = simpleGit(dirPath);
      await git.status();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get repository root directory
   */
  async getRepositoryRoot(): Promise<string> {
    try {
      const root = await this.git.revparse(['--show-toplevel']);
      return root.trim();
    } catch (error) {
      throw new Error(`Not a git repository: ${this.repoPath}`);
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    const status = await this.git.status();
    return status.current || 'unknown';
  }

  /**
   * Get repository status
   */
  async getStatus(): Promise<StatusResult> {
    return await this.git.status();
  }

  /**
   * Get remote URL
   */
  async getRemoteUrl(remoteName: string = 'origin'): Promise<string | null> {
    try {
      const remotes = await this.git.getRemotes(true);
      const remote = remotes.find(r => r.name === remoteName);
      return remote?.refs.fetch || null;
    } catch {
      return null;
    }
  }

  /**
   * Get the GitHub owner/repo slug for the configured remote.
   */
  async getGitHubRemoteSlug(remoteName: string = 'origin'): Promise<{ owner: string; repo: string } | null> {
    const remoteUrl = await this.getRemoteUrl(remoteName);
    if (!remoteUrl) {
      return null;
    }

    return GitUtils.parseGitHubUrl(remoteUrl);
  }

  /**
   * Parse GitHub URL to get owner and repo
   */
  static parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    const patterns = [
      /github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/,
      /github\.com\/([^/]+)\/([^/]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(/\.git$/, ''),
        };
      }
    }

    return null;
  }

  /**
   * Get list of modified files
   */
  async getModifiedFiles(): Promise<string[]> {
    const status = await this.git.status();
    return [
      ...status.modified,
      ...status.created,
      ...status.deleted,
      ...status.renamed.map(r => r.to),
    ];
  }

  /**
   * Get file history
   */
  async getFileHistory(filePath: string, maxCount: number = 10): Promise<any[]> {
    try {
      const log = await this.git.log({
        file: filePath,
        maxCount,
      });
      return log.all as any[];
    } catch {
      return [];
    }
  }

  /**
   * Get contributors
   */
  async getContributors(): Promise<Array<{ name: string; email: string; commits: number }>> {
    try {
      const log = await this.git.log();
      const contributorMap = new Map<string, { name: string; email: string; commits: number }>();

      for (const commit of log.all) {
        const key = commit.author_email;
        if (contributorMap.has(key)) {
          contributorMap.get(key)!.commits++;
        } else {
          contributorMap.set(key, {
            name: commit.author_name,
            email: commit.author_email,
            commits: 1,
          });
        }
      }

      return Array.from(contributorMap.values()).sort((a, b) => b.commits - a.commits);
    } catch {
      return [];
    }
  }

  /**
   * Get recent commits
   */
  async getRecentCommits(maxCount: number = 10): Promise<any[]> {
    try {
      const log = await this.git.log({ maxCount });
      return log.all as any[];
    } catch {
      return [];
    }
  }

  /**
   * Check if file is tracked by git
   */
  async isFileTracked(filePath: string): Promise<boolean> {
    try {
      await this.git.raw(['ls-files', '--error-unmatch', filePath]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get .gitignore patterns
   */
  static getGitignorePatterns(repoPath: string): string[] {
    const gitignorePath = path.join(repoPath, '.gitignore');
    
    if (!fs.existsSync(gitignorePath)) {
      return [];
    }

    const content = fs.readFileSync(gitignorePath, 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  }

  /**
   * Get repository age in days
   */
  async getRepositoryAge(): Promise<number> {
    try {
      const log = await this.git.log();
      if (log.all.length === 0) return 0;

      const firstCommit = log.all[log.all.length - 1];
      const firstCommitDate = new Date(firstCommit.date);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - firstCommitDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays;
    } catch {
      return 0;
    }
  }

  /**
   * Get total commit count
   */
  async getTotalCommits(): Promise<number> {
    try {
      const result = await this.git.raw(['rev-list', '--count', 'HEAD']);
      return parseInt(result.trim(), 10);
    } catch {
      return 0;
    }
  }

  /**
   * Get branches
   */
  async getBranches(): Promise<string[]> {
    try {
      const branches = await this.git.branch();
      return branches.all;
    } catch {
      return [];
    }
  }

  /**
   * Get tags
   */
  async getTags(): Promise<string[]> {
    try {
      const tags = await this.git.tags();
      return tags.all;
    } catch {
      return [];
    }
  }
}
