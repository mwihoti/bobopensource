import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { auth } from '@clerk/nextjs/server';
import { RepositoryAnalyzer } from '@core/analyzers/repository';
import { IssueAnalyzer } from '@core/analyzers/issue';
import { DependencyMapper } from '@core/analyzers/dependency-mapper';
import { ImplementationPlanner } from '@core/analyzers/implementation-planner';
import { AnalysisConfig } from '@core/types';
import { GitUtils } from '@core/utils/git';
import { saveAnalysisRun } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { issueUrl, repoPath } = await request.json();

    if (!issueUrl) {
      return NextResponse.json({ error: 'Issue URL is required' }, { status: 400 });
    }

    const config: AnalysisConfig = {
      ignorePatterns: ['node_modules', 'dist', 'build', '.git'],
      maxFileSize: 1024 * 1024,
      includeTests: true,
    };

    const issueRepo = GitUtils.parseGitHubUrl(issueUrl);
    if (!issueRepo) {
      return NextResponse.json({ error: 'Invalid GitHub issue URL' }, { status: 400 });
    }

    let repoInfo;

    if (repoPath) {
      const resolvedRepoPath = path.resolve(repoPath);
      if (!fs.existsSync(resolvedRepoPath)) {
        return NextResponse.json({ error: `Repository path does not exist: ${resolvedRepoPath}` }, { status: 400 });
      }

      const repoAnalyzer = new RepositoryAnalyzer(resolvedRepoPath, config);
      repoInfo = await repoAnalyzer.analyze();
    } else {
      repoInfo = await RepositoryAnalyzer.analyzeRemote(issueRepo.owner, issueRepo.repo, config);
    }

    // 2. Analyze issue
    const issueAnalyzer = new IssueAnalyzer(repoInfo);
    const issueInfo = await issueAnalyzer.analyzeIssue(issueUrl);

    // 3. Dependency Map
    const dependencyMapper = new DependencyMapper(repoInfo);
    const dependencyMap = await dependencyMapper.buildDependencyMap();

    // 4. Implementation Plan
    const planner = new ImplementationPlanner(repoInfo, dependencyMapper);
    const plan = await planner.generatePlan(issueInfo, dependencyMap);

    const responsePayload = {
      repoInfo,
      issueInfo,
      dependencyMap,
      plan,
      logs: [],
    };

    const analysisId = await saveAnalysisRun({
      userId,
      issueUrl,
      repoPath,
      issueTitle: issueInfo.title,
      issueNumber: issueInfo.number,
      repositorySlug: repoInfo.slug,
      response: responsePayload,
    });

    return NextResponse.json({
      ...responsePayload,
      analysisId,
    });
  } catch (error: any) {
    console.error('Analysis failed:', error);
    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 });
  }
}
