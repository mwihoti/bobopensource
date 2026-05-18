import { neon } from '@neondatabase/serverless';

let schemaReady = false;

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL or NEON_DATABASE_URL must be set to save responses.');
  }
  return url;
}

function getSql() {
  return neon(getDatabaseUrl());
}

export async function ensureDatabaseSchema() {
  if (schemaReady) {
    return;
  }

  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS analysis_runs (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      issue_url TEXT NOT NULL,
      repo_path TEXT,
      issue_title TEXT,
      issue_number INTEGER,
      repository_slug TEXT,
      response JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS bob_conversations (
      id BIGSERIAL PRIMARY KEY,
      analysis_run_id BIGINT REFERENCES analysis_runs(id) ON DELETE SET NULL,
      user_id TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      evidence JSONB,
      follow_ups JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  schemaReady = true;
}

export async function saveAnalysisRun(input: {
  userId: string;
  issueUrl: string;
  repoPath?: string;
  issueTitle?: string;
  issueNumber?: number;
  repositorySlug?: string;
  response: unknown;
}): Promise<number> {
  await ensureDatabaseSchema();
  const sql = getSql();

  const rows = await sql`
    INSERT INTO analysis_runs (
      user_id,
      issue_url,
      repo_path,
      issue_title,
      issue_number,
      repository_slug,
      response
    ) VALUES (
      ${input.userId},
      ${input.issueUrl},
      ${input.repoPath || null},
      ${input.issueTitle || null},
      ${input.issueNumber || null},
      ${input.repositorySlug || null},
      ${JSON.stringify(input.response)}
    )
    RETURNING id
  `;

  return Number((rows[0] as { id: number }).id);
}

export async function saveBobConversation(input: {
  userId: string;
  analysisRunId?: number;
  question: string;
  answer: string;
  evidence?: string[];
  followUps?: string[];
}): Promise<number> {
  await ensureDatabaseSchema();
  const sql = getSql();

  const rows = await sql`
    INSERT INTO bob_conversations (
      analysis_run_id,
      user_id,
      question,
      answer,
      evidence,
      follow_ups
    ) VALUES (
      ${input.analysisRunId || null},
      ${input.userId},
      ${input.question},
      ${input.answer},
      ${JSON.stringify(input.evidence || [])},
      ${JSON.stringify(input.followUps || [])}
    )
    RETURNING id
  `;

  return Number((rows[0] as { id: number }).id);
}

export async function getUserAnalyses(userId: string) {
  await ensureDatabaseSchema();
  const sql = getSql();

  const runs = await sql`
    SELECT id, user_id, issue_url, repo_path, issue_title, issue_number, repository_slug, created_at 
    FROM analysis_runs 
    WHERE user_id = ${userId} 
    ORDER BY created_at DESC
  `;

  return runs;
}

export async function getAnalysisWithConversations(analysisId: number, userId: string) {
  await ensureDatabaseSchema();
  const sql = getSql();

  const runs = await sql`
    SELECT * FROM analysis_runs 
    WHERE id = ${analysisId} AND user_id = ${userId}
  `;

  if (runs.length === 0) return null;

  const conversations = await sql`
    SELECT * FROM bob_conversations 
    WHERE analysis_run_id = ${analysisId} AND user_id = ${userId}
    ORDER BY created_at ASC
  `;

  return {
    ...runs[0],
    conversations
  };
}
