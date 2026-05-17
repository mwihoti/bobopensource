# BobOpenSource Web

The `web/` folder contains the Next.js application for BobOpenSource.

It provides a signed-in web experience for:
- analyzing GitHub issues against local or remote repositories,
- generating implementation plans and dependency views,
- asking follow-up questions through `Ask Bob`,
- saving analysis runs and conversations to Neon.

## What This App Does

The web app is the product UI for BobOpenSource. A user signs in with GitHub through Clerk, enters a GitHub issue URL, and gets:
- repository context,
- issue analysis,
- dependency analysis,
- implementation roadmap,
- Ask Bob follow-up guidance.

Each successful analysis is saved to Neon, and Ask Bob responses are stored as conversation records linked back to that analysis.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Clerk for authentication
- Neon serverless Postgres for persistence
- Framer Motion for transitions
- Lucide React for icons

## Authentication

Authentication is handled with Clerk.

Current setup:
- `src/app/layout.tsx`: wraps the app in `ClerkProvider`
- `src/middleware.ts`: protects `/`, `/api/analyze`, and `/api/ask-bob`
- `src/app/sign-in/[[...sign-in]]/page.tsx`: sign-in page
- `src/app/sign-up/[[...sign-up]]/page.tsx`: sign-up page

Important:
- GitHub login must be enabled as a social provider in your Clerk dashboard.
- Having Clerk env vars alone is not enough if GitHub is not enabled in Clerk.

## Persistence

Persistence is handled through Neon in `src/lib/db.ts`.

The app creates and uses two tables:
- `analysis_runs`
- `bob_conversations`

`analysis_runs` stores:
- Clerk user id
- issue URL
- optional repo path
- issue metadata
- the full JSON response payload returned by the analysis flow

`bob_conversations` stores:
- Clerk user id
- linked analysis id when available
- user question
- Bob answer
- evidence
- follow-up suggestions

## Environment Variables

Create `web/.env.local` or otherwise expose the following vars to the Next.js app:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
DATABASE_URL=postgres://...
```

Notes:
- `DATABASE_URL` can point to your Neon database.
- `NEON_DATABASE_URL` is also supported by the DB helper as a fallback.
- The core analyzer also expects `GITHUB_TOKEN` when you need higher GitHub API limits or private repo access.

## Development

From the `web/` directory:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

If port `3000` is already in use, Next.js will choose another port.

## Build and Typecheck

Run the web app typecheck:

```bash
./node_modules/.bin/tsc --noEmit
```

Run a production build:

```bash
npm run build
```

## API Routes

### `POST /api/analyze`

Protected by Clerk.

Responsibilities:
- validate the GitHub issue URL,
- analyze the target repository locally or remotely,
- analyze the issue,
- build the dependency map,
- generate the implementation plan,
- save the resulting analysis to Neon,
- return the response plus `analysisId`.

Implemented in:
- `src/app/api/analyze/route.ts`

### `POST /api/ask-bob`

Protected by Clerk.

Responsibilities:
- accept a follow-up question plus current analysis context,
- optionally fetch file content on demand for file-specific questions,
- generate a contextual Bob response,
- save the conversation record to Neon.

Implemented in:
- `src/app/api/ask-bob/route.ts`

## Key Files

- `src/app/page.tsx`
  Main product UI for entering an issue URL, browsing the analysis tabs, and using Ask Bob.

- `src/app/layout.tsx`
  App shell and Clerk provider.

- `src/middleware.ts`
  Clerk route protection.

- `src/lib/db.ts`
  Neon connection and table helpers.

- `src/app/api/analyze/route.ts`
  Analysis pipeline endpoint.

- `src/app/api/ask-bob/route.ts`
  Ask Bob endpoint with persistence.

## Relationship to the Core Analyzer

This app does not reimplement the analyzer logic. It imports the main analysis engine from the repository root through the `@core/*` path alias and uses:
- repository analyzer,
- issue analyzer,
- dependency mapper,
- implementation planner,
- GitHub utilities,
- Ask Bob assistant logic.

That means:
- the CLI and the web app share the same core analysis behavior,
- web-specific code in this folder focuses on auth, persistence, and presentation.

## Current Product Flow

1. User signs in with GitHub through Clerk.
2. User submits a GitHub issue URL.
3. The app analyzes the issue and repository.
4. The full result is saved to Neon.
5. The UI shows insights, dependencies, implementation plan, and Ask Bob.
6. Ask Bob replies are also saved to Neon and linked to the analysis when possible.

## Live App

Live deployment:

```text
https://bobopensource-live.vercel.app
```

## Troubleshooting

### Clerk says middleware was not run

The Clerk middleware file must be at:

```text
src/middleware.ts
```

Not at the project root of `web/`.

### GitHub API rate limit errors

Make sure `GITHUB_TOKEN` is available to the running Next.js process.

### Analysis saves fail

Check:
- `DATABASE_URL` or `NEON_DATABASE_URL`
- Neon connectivity
- whether the Clerk user is authenticated

### GitHub login does not appear

Check:
- Clerk env vars are loaded,
- GitHub is enabled in Clerk social providers,
- the app was restarted after env changes.
