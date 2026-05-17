import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

export interface GitHubIssueResponse {
  title: string;
  body: string | null;
  state: string;
  user?: { login?: string };
  labels?: Array<{ name?: string }>;
  created_at?: string;
  updated_at?: string;
}

export interface GitHubIssueCommentResponse {
  body?: string | null;
  user?: { login?: string };
  created_at?: string;
}

export interface GitHubRepositoryResponse {
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  default_branch: string;
  homepage: string | null;
  topics?: string[];
}

export interface GitHubTreeResponse {
  tree: Array<{
    path: string;
    type: 'blob' | 'tree';
  }>;
  truncated?: boolean;
}

export interface GitHubContentResponse {
  content?: string;
  encoding?: string;
  path?: string;
}

export class GitHubClient {
  private headers: Record<string, string>;
  private static envLoaded = false;

  constructor() {
    GitHubClient.loadEnvFiles();

    this.headers = {
      'User-Agent': 'bobopensource',
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (process.env.GITHUB_TOKEN) {
      this.headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
  }

  async getIssue(owner: string, repo: string, number: number): Promise<GitHubIssueResponse> {
    return this.getJson<GitHubIssueResponse>(`https://api.github.com/repos/${owner}/${repo}/issues/${number}`);
  }

  async getIssueComments(owner: string, repo: string, number: number): Promise<GitHubIssueCommentResponse[]> {
    return this.getJson<GitHubIssueCommentResponse[]>(`https://api.github.com/repos/${owner}/${repo}/issues/${number}/comments?per_page=20`);
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepositoryResponse> {
    return this.getJson<GitHubRepositoryResponse>(`https://api.github.com/repos/${owner}/${repo}`);
  }

  async getReadme(owner: string, repo: string): Promise<string> {
    return this.decodeContent(
      await this.getJson<GitHubContentResponse>(`https://api.github.com/repos/${owner}/${repo}/readme`)
    );
  }

  async getTree(owner: string, repo: string, ref: string): Promise<GitHubTreeResponse> {
    return this.getJson<GitHubTreeResponse>(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`
    );
  }

  async getFileContent(owner: string, repo: string, filePath: string, ref?: string): Promise<string> {
    const suffix = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    return this.decodeContent(
      await this.getJson<GitHubContentResponse>(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}${suffix}`
      )
    );
  }

  private decodeContent(response: GitHubContentResponse): string {
    if (!response.content) {
      return '';
    }

    if (response.encoding === 'base64') {
      return Buffer.from(response.content, 'base64').toString('utf-8');
    }

    return response.content;
  }

  async getJson<T>(url: string): Promise<T> {
    return await new Promise<T>((resolve, reject) => {
      const request = https.get(url, { headers: this.headers }, (response) => {
        const statusCode = response.statusCode ?? 500;
        let body = '';

        response.on('data', chunk => {
          body += chunk;
        });

        response.on('end', () => {
          if (statusCode < 200 || statusCode >= 300) {
            let details = '';
            let apiMessage = '';
            try {
              const parsed = JSON.parse(body) as { message?: string };
              apiMessage = parsed.message || '';
              details = apiMessage ? `: ${apiMessage}` : '';
            } catch {
              details = body ? `: ${body}` : '';
            }

            reject(new Error(this.buildGitHubErrorMessage(url, statusCode, apiMessage || body)));
            return;
          }

          try {
            resolve(JSON.parse(body) as T);
          } catch (error) {
            reject(new Error(`Failed to parse GitHub API response: ${error instanceof Error ? error.message : String(error)}`));
          }
        });
      });

      request.on('error', error => {
        reject(new Error(`Failed to fetch GitHub data: ${error.message}`));
      });
    });
  }

  private buildGitHubErrorMessage(url: string, statusCode: number, apiMessage: string): string {
    if (statusCode === 404) {
      if (url.includes('/issues/')) {
        return [
          'GitHub returned 404 for this issue resource.',
          'The issue may not exist, may have been deleted, or may require authentication to view.',
          process.env.GITHUB_TOKEN
            ? 'A GITHUB_TOKEN is set, so this is more likely a bad issue URL or a missing issue.'
            : 'If the issue is private or access-restricted, set GITHUB_TOKEN and try again.',
          `Resource: ${url}`,
        ].join(' ');
      }

      if (url.includes('/contents/')) {
        return [
          'GitHub returned 404 for a repository file lookup.',
          'The issue itself may still exist; this usually means the suggested file path or branch does not exist in that repository.',
          process.env.GITHUB_TOKEN
            ? 'A GITHUB_TOKEN is set, so this is probably a missing file path rather than an auth problem.'
            : 'If the repository is access-restricted, set GITHUB_TOKEN, but for public repos this usually indicates a bad file path.',
          `Resource: ${url}`,
        ].join(' ');
      }

      return [
        'GitHub returned 404 for this resource.',
        'The resource may not exist, may have moved, or may require authentication to view.',
        process.env.GITHUB_TOKEN
          ? 'A GITHUB_TOKEN is set, so this is more likely a bad URL or a missing resource.'
          : 'If the resource is private or access-restricted, set GITHUB_TOKEN and try again.',
        `Resource: ${url}`,
      ].join(' ');
    }

    if (statusCode === 403) {
      return [
        'GitHub API access was denied (403).',
        apiMessage ? `GitHub said: ${apiMessage}.` : '',
        'This can happen because of rate limits or missing authentication.',
        process.env.GITHUB_TOKEN ? 'Check whether the token has permission to read the repository and issues.' : 'Set GITHUB_TOKEN and try again.',
        `Resource: ${url}`,
      ].filter(Boolean).join(' ');
    }

    return `GitHub API request failed with status ${statusCode}${apiMessage ? `: ${apiMessage}` : ''}`;
  }

  private static loadEnvFiles(): void {
    if (GitHubClient.envLoaded) {
      return;
    }

    const candidates = new Set<string>();
    let currentDir = process.cwd();
    for (let depth = 0; depth < 5; depth++) {
      candidates.add(path.join(currentDir, '.env'));
      candidates.add(path.join(currentDir, '.env.local'));
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        break;
      }
      currentDir = parentDir;
    }

    if (process.env.HOME) {
      candidates.add(path.join(process.env.HOME, '.env'));
    }

    for (const envPath of candidates) {
      if (!fs.existsSync(envPath)) {
        continue;
      }

      try {
        const content = fs.readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) {
            continue;
          }

          const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
          const match = normalized.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
          if (!match) {
            continue;
          }

          const key = match[1];
          let value = match[2].trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }

          if (!(key in process.env)) {
            process.env[key] = value;
          }
        }
      } catch {
        // Ignore unreadable env files and continue.
      }
    }

    GitHubClient.envLoaded = true;
  }
}
