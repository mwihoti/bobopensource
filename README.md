# BobOpenSource

BobOpenSource is an AI-assisted developer tool for turning GitHub issues into practical contribution guidance.

It analyzes a repository, reads the issue, maps likely dependencies, and produces:
- project overview,
- suggested files to inspect,
- implementation roadmap,
- code and test guidance,
- risk notes,
- PR draft suggestions,
- follow-up help through Ask Bob.

## Live App

```text
https://bobopensource-live.vercel.app
```

## Repository

```text
https://github.com/mwihoti/bobopensource
```

## What It Does

BobOpenSource helps developers understand unfamiliar open source issues faster.

Main capabilities:
- analyze a GitHub issue URL,
- inspect a local repository or analyze a remote repository structure,
- generate dependency-aware implementation plans,
- suggest likely starting files,
- generate test and validation guidance,
- support follow-up Q&A through Ask Bob,
- persist signed-in analysis runs and conversations in Neon.

## Product Modes

### CLI

The CLI can:
- analyze a repository,
- analyze an issue,
- generate an implementation plan,
- inspect dependency relationships.

### Web App

The web app adds:
- guided UI for issue analysis,
- Insights, Dependencies, Plan, and Ask Bob tabs,
- Clerk GitHub login,
- Neon-backed persistence for saved analyses and Ask Bob replies.

The web app lives in [web/README.md](/home/mwihotidan/work/bobopensource/web/README.md).

## Core Features

- **Issue Analysis**: extracts requirements, acceptance criteria, labels, and discussion context from GitHub issues
- **Repository Analysis**: infers project structure, conventions, and likely entry points
- **Dependency Mapping**: builds change-impact context from repository relationships
- **Implementation Planning**: generates a developer-facing roadmap with actions, validation, and time estimates
- **Ask Bob**: answers follow-up questions about files, tests, code paths, docs, and risk
- **Auth and Persistence**: saves analysis runs and conversations for signed-in users

## Current Stack

### Core

- TypeScript
- Node.js
- Commander
- Simple Git
- Glob
- YAML

### Web

- Next.js 16
- React 19
- TypeScript
- Framer Motion
- Lucide React
- TailwindCSS 4

### Auth and Data

- Clerk
- Neon serverless Postgres
- GitHub API

## How It Works

1. User provides a GitHub issue URL.
2. BobOpenSource analyzes the target repository locally or remotely.
3. The issue is parsed into requirements, acceptance criteria, and discussion highlights.
4. A dependency map and implementation plan are generated.
5. The web app presents the result as a project overview, roadmap, and Ask Bob experience.
6. Signed-in web users have analyses and Ask Bob conversations stored in Neon.

## Installation

### Core CLI

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Run the CLI:

```bash
node dist/cli.js --help
```

### Web App

Start the web app:

```bash
cd web
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

If port `3000` is already in use, Next.js will choose another port.

## CLI Usage

### Analyze an Issue

```bash
node dist/cli.js analyze https://github.com/owner/repo/issues/123
```

With a local repository path:

```bash
node dist/cli.js analyze https://github.com/owner/repo/issues/123 -r /path/to/repo
```

### Analyze Repository Only

```bash
node dist/cli.js repo
```

### Analyze Issue Only

```bash
node dist/cli.js issue https://github.com/owner/repo/issues/123
```

### Generate a Plan

```bash
node dist/cli.js plan https://github.com/owner/repo/issues/123
```

### Analyze Dependencies

```bash
node dist/cli.js deps src/app.ts src/utils.ts
```

## Environment Variables

### GitHub

For higher GitHub API rate limits or private repository access:

```env
GITHUB_TOKEN=...
```

### Web App Auth and Persistence

Set these in `web/.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
DATABASE_URL=postgres://...
```

Notes:
- `NEON_DATABASE_URL` is also supported as a fallback in the DB helper.
- GitHub login must be enabled in the Clerk dashboard.

## Configuration

Create a config file in the repository root:

### `.bobopensourcerc.json`

```json
{
  "ignorePatterns": [
    "node_modules",
    "dist",
    "build",
    ".git",
    "coverage"
  ],
  "maxFileSize": 1048576,
  "includeTests": true
}
```

Supported config files:
- `.bobopensourcerc`
- `.bobopensourcerc.json`
- `.bobopensourcerc.js`
- `bobopensource.config.js`
- `bobopensource.config.json`

## Key Paths

- `src/`
  Core analyzers, utilities, types, and planning logic

- `web/`
  Next.js product UI, Clerk auth, Neon persistence, and Ask Bob routes

- `docs/presentation/`
  BobOpenSource PDF presentation and cover assets

## Development

Build the core package:

```bash
npm run build
```

Typecheck the web app:

```bash
cd web
./node_modules/.bin/tsc --noEmit
```

Run the web app:

```bash
cd web
npm run dev
```

## Notes

- The CLI and the web app share the same core analysis engine.
- The web app adds authentication, persistence, and a richer developer workflow.
- Ask Bob can answer questions using generated plan context and can fetch file content on demand for file-specific questions.

## Credits

This project workflow also used:
- IBM Bob: `https://bob.ibm.com/`

## Developer

Daniel Mwihoti  
Software Developer

- LinkedIn: `https://www.linkedin.com/in/daniel-mwihoti-3aaa652b9/`
- GitHub: `https://github.com/mwihoti`
