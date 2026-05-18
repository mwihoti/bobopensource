import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function exportSessions() {
  // 1. Load DATABASE_URL from .env.local if not in environment
  let databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  
  if (!databaseUrl) {
    const envPaths = [
      path.resolve(__dirname, '../.env.local'),
      path.resolve(__dirname, '../../.env'),
      path.resolve(__dirname, '../../.env.local')
    ];

    for (const envPath of envPaths) {
      if (fs.existsSync(envPath)) {
        try {
          const envContent = fs.readFileSync(envPath, 'utf8');
          const match = envContent.match(/DATABASE_URL=(.*)/) || envContent.match(/NEON_DATABASE_URL=(.*)/);
          if (match && match[1]) {
            databaseUrl = match[1].trim();
            console.log(`Loaded database URL from ${path.basename(envPath)}`);
            break;
          }
        } catch (err) {
          console.error(`Could not read ${envPath}:`, err.message);
        }
      }
    }
  }

  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL or NEON_DATABASE_URL environment variable is not set.');
    console.log('Please set it in your terminal or ensure .env.local exists in the web directory.');
    process.exit(1);
  }

  console.log('Connecting to Neon database...');
  const sql = neon(databaseUrl);

  try {
    // 2. Fetch all analysis runs
    console.log('Fetching analysis runs...');
    const runs = await sql`SELECT * FROM analysis_runs ORDER BY created_at DESC`;
    
    if (runs.length === 0) {
      console.log('No sessions found in the database.');
      return;
    }

    // 3. Fetch all conversations
    console.log('Fetching conversations...');
    const conversations = await sql`SELECT * FROM bob_conversations ORDER BY created_at ASC`;

    // 4. Prepare output directory
    const outputDir = path.resolve(__dirname, '../../bob_sessions');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Exporting ${runs.length} sessions to ${outputDir}...`);

    // 5. Group and save
    for (const run of runs) {
      const runConversations = conversations.filter(c => c.analysis_run_id === run.id);
      
      const sessionData = {
        sessionId: run.id,
        userId: run.user_id,
        issueUrl: run.issue_url,
        issueTitle: run.issue_title,
        repository: run.repository_slug,
        createdAt: run.created_at,
        analysisResult: run.response,
        conversations: runConversations.map(c => ({
          question: c.question,
          answer: c.answer,
          evidence: c.evidence,
          followUps: c.follow_ups,
          createdAt: c.created_at
        })),
        exportMetadata: {
          exportedAt: new Date().toISOString(),
          version: '1.0.0'
        }
      };

      const baseName = `session-${run.id}-${run.repository_slug?.replace(/\//g, '-') || 'unknown'}`;
      
      // Save JSON
      fs.writeFileSync(path.join(outputDir, `${baseName}.json`), JSON.stringify(sessionData, null, 2));

      // Save Markdown
      let mdContent = `# BobOpenSource Session Log\n\n`;
      mdContent += `**Session ID:** ${run.id}\n`;
      mdContent += `**Repository:** ${run.repository_slug}\n`;
      mdContent += `**Issue:** [${run.issue_title || 'Link'}](${run.issue_url})\n`;
      mdContent += `**Created At:** ${run.created_at}\n\n`;
      mdContent += `## Analysis Summary\n\n`;
      
      const res = run.response;
      if (res && res.plan) {
        mdContent += `### Implementation Plan\n`;
        mdContent += `- **Estimated Effort:** ${res.plan.estimatedHours}h\n`;
        mdContent += `- **Steps:** ${res.plan.steps?.length || 0}\n\n`;
        
        res.plan.steps?.forEach((step) => {
          mdContent += `#### Step ${step.number}: ${step.title}\n`;
          mdContent += `${step.description}\n\n`;
        });
      }

      if (sessionData.conversations.length > 0) {
        mdContent += `## Ask Bob Conversation\n\n`;
        sessionData.conversations.forEach((conv, idx) => {
          mdContent += `### Question ${idx + 1}\n**User:** ${conv.question}\n\n`;
          mdContent += `**Bob:** ${conv.answer}\n\n`;
          if (conv.evidence?.length > 0) {
            mdContent += `**Evidence:**\n`;
            conv.evidence.forEach(e => mdContent += `- ${e}\n`);
            mdContent += `\n`;
          }
        });
      }

      fs.writeFileSync(path.join(outputDir, `${baseName}.md`), mdContent);
      console.log(`  - Exported: ${baseName}.md / .json`);
    }

    console.log('\nSUCCESS: All sessions have been exported to the "bob-sessions/" directory.');
    console.log('You can now commit this directory to your GitHub repository.');

  } catch (error) {
    console.error('Export failed:', error.message);
    process.exit(1);
  }
}

exportSessions();
