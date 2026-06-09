# Project Dashboard

A personal, single-user daily dashboard for project time blocks and subtasks.
Built with Next.js (App Router) and TypeScript, styled with Tailwind, and backed
by a JSON file stored in GitHub. Deployed on Vercel.

There is no authentication. This is meant for one person running their own copy.

## What it does

- **Today view.** A list of flexible time blocks for the current day. Each block
  has a start time, end time, project, and status (planned, in progress, complete).
- **Subtasks.** Each block holds an inline checklist you can add to, check off,
  and clear.
- **Stale projects.** A section that surfaces any active project untouched for
  five or more days, with a one-click action to bump it into today's schedule.

## How data flows

The source of truth is a single JSON file in a GitHub repo (see
[`schema/projects.schema.json`](schema/projects.schema.json) for the shape and
[`schema/example-data.json`](schema/example-data.json) for a worked example).

- **Reads** happen in server components via the GitHub Contents API, with short
  revalidation so edits show up without a redeploy.
- **Writes** go through the `/api/projects` route handler, which commits the
  updated file back to GitHub. Each write sends the file's SHA so a stale write
  is rejected rather than silently overwriting newer data.

The GitHub token lives only in a server-side environment variable. It is never
sent to the browser.

## Project structure

```
project-dashboard/
├── app/
│   ├── layout.tsx              root layout
│   ├── page.tsx                the daily dashboard (server component)
│   └── api/projects/route.ts   GET reads data, PUT saves it back to GitHub
├── components/
│   ├── DailySchedule.tsx       today's blocks, owns add/edit/reorder state
│   ├── TimeBlock.tsx           one block plus its inline subtask checklist
│   └── StaleProjects.tsx       stale list with the bump-into-today action
├── lib/
│   ├── types.ts                shared TypeScript types
│   ├── github.ts               read/write the JSON file via the GitHub API
│   └── data.ts                 pure helpers: today, stale, day filtering
└── schema/
    ├── projects.schema.json    JSON Schema for the data file
    └── example-data.json       example data you can seed the repo with
```

## Setup

1. Create a separate GitHub repo to hold the data (for example
   `project-dashboard-data`) and commit your data file, for instance at
   `data/projects.json`. You can start from `schema/example-data.json`.

2. Create a fine-grained GitHub personal access token scoped to that one repo
   with **Contents: Read and write** permission.

3. Copy the environment template and fill it in:

   ```bash
   cp .env.example .env.local
   ```

   | Variable            | Meaning                                      |
   | ------------------- | -------------------------------------------- |
   | `GITHUB_TOKEN`      | Your fine-grained PAT                         |
   | `GITHUB_REPO_OWNER` | GitHub username or org that owns the data repo |
   | `GITHUB_REPO_NAME`  | The data repo name                            |
   | `GITHUB_DATA_PATH`  | Path to the JSON file, e.g. `data/projects.json` |
   | `GITHUB_BRANCH`     | Branch to read and write, defaults to `main`  |

4. Install and run:

   ```bash
   npm install
   npm run dev
   ```

   Open http://localhost:3000.

## Deploying to Vercel

1. Push this app to its own GitHub repo and import it into Vercel.
2. Add the same environment variables in Vercel under
   **Project Settings -> Environment Variables**.
3. Deploy. Reads use revalidation, so data edits appear without a redeploy.

## Current state

This is a scaffold. The structure, data layer, types, schema, and component
props are in place. The interactive bodies (the add/edit forms, drag-to-reorder,
subtask toggling, and the persistence calls) are stubbed with clearly marked
`TODO` comments so they can be filled in next.
