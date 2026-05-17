import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { auth } from '@clerk/nextjs/server';
import { BobAssistant, BobChatContext, BobChatMessage } from '@core/utils/bob-assistant';
import { GitHubClient } from '@core/utils/github';
import { saveBobConversation } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { question, context, history, analysisId } = await request.json() as {
      question?: string;
      context?: BobChatContext;
      history?: BobChatMessage[];
      analysisId?: number;
    };

    if (!question?.trim()) {
      return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    }

    if (!context?.issueInfo || !context?.repoInfo || !context?.plan) {
      return NextResponse.json({ error: 'Analysis context is required' }, { status: 400 });
    }

    const filePath = extractFilePath(question);
    const extraFileContexts = filePath
      ? await buildExtraFileContexts(context, filePath)
      : undefined;

    const response = BobAssistant.answer(question, {
      ...context,
      extraFileContexts,
    }, history || []);

    await saveBobConversation({
      userId,
      analysisRunId: analysisId,
      question,
      answer: response.answer,
      evidence: response.evidence,
      followUps: response.followUps,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to answer question' }, { status: 500 });
  }
}

function extractFilePath(question: string): string | undefined {
  const explicitMatch = question.match(/([A-Za-z0-9_./-]+\.(?:rs|ts|tsx|js|jsx|go|py|proto|md|toml|yaml|yml))/);
  return explicitMatch?.[1];
}

async function buildExtraFileContexts(context: BobChatContext, filePath: string): Promise<Record<string, string> | undefined> {
  const content = await getFileContent(context, filePath);
  if (!content) {
    return undefined;
  }

  return {
    [filePath]: trimFileContent(content),
  };
}

async function getFileContent(context: BobChatContext, filePath: string): Promise<string> {
  if (context.repoInfo.source === 'local') {
    const fullPath = path.join(context.repoInfo.path, filePath);
    if (!fs.existsSync(fullPath)) {
      return '';
    }
    return fs.readFileSync(fullPath, 'utf-8');
  }

  const slug = context.repoInfo.slug;
  if (!slug) {
    return '';
  }

  const [owner, repo] = slug.split('/');
  const github = new GitHubClient();

  try {
    return await github.getFileContent(owner, repo, filePath, context.repoInfo.defaultBranch);
  } catch {
    return '';
  }
}

function trimFileContent(content: string): string {
  return content
    .split('\n')
    .slice(0, 80)
    .join('\n')
    .trim();
}
