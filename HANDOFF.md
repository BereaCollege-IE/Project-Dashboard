# Project Dashboard — Session Handoff

Read this first when picking up work on this project. Last updated: 2026-06-09.

## What this is

A single-user (Rob Smith) personal project dashboard. Next.js 15 (app router) +
TypeScript + Tailwind, deployed on Vercel, using a JSON file in GitHub as the
database. No authentication by design.

- **Live site:** https://project-dashboard-theta-seven.vercel.app/
- **Repo (code + data):** https://github.com/BereaCollege-IE/Project-Dashboard
- **Vercel:** team "Rob's projects" (slug `academicaffairs-project-tracker`),
  project `project-dashboard`. NOT git-connected: deploys are manual/direct, so
  data commits never trigger rebuilds.

## Critical invariants (do not break these)

1. **`data/projects.json` on `main` is the live database.** The deployed app
   reads and commits it via the GitHub Contents API. NEVER commit the local
   working-tree copy of `data/projects.json`; it is always stale. When merging
   code into `main`, verify the live data file is preserved
   (`git rev-parse origin/main:data/projects.json` must equal the merged blob).
2. **Branch flow:** author code commits on `feature/dashboard-app`, then merge
   into `main` (Rob's rule: never commit directly to main). Remote `main` moves
   on its own (app data commits), so always fetch + merge `origin/main` before
   pushing main.
3. **Secrets:** `.env.local` (gitignored) holds GITHUB_TOKEN and
   ANTHROPIC_API_KEY. Before every commit, verify no `.env.local`, no `sk-ant-`,
   no `github_pat_` in the staged diff. `.env.example` must stay blank.
4. **No em dashes** anywhere in UI text or docs (Rob's standing rule). Plain,
   warm language in UI copy.

## Deploying

```
cd "/Users/robsmith/Desktop/Claude Code Workbench/project-dashboard"
~/.npm-global/bin/vercel deploy --prod --yes
```

The Vercel CLI is installed at `~/.npm-global/bin/vercel` (not on Rob's default
PATH) and is logged in as `bereacollege-ie` (interactive login, no token
needed). Env vars only apply to new deployments.

## Environment variables

| Where | Names |
|---|---|
| Local `.env.local` + Vercel Production | `GITHUB_TOKEN`, `GITHUB_REPO_OWNER=BereaCollege-IE`, `GITHUB_REPO_NAME=Project-Dashboard`, `GITHUB_DATA_PATH=data/projects.json`, `GITHUB_BRANCH=main`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (optional) |
| Vercel only, NOT yet set (email reminders dormant until then) | `AUTH_EMAIL_USER`, `AUTH_EMAIL_PASS`, `AUTH_EMAIL_FROM` (Gmail SMTP, same pattern as Rob's Project Tracker app), `CRON_SECRET` |

GitHub token: fine-grained PAT, resource owner `BereaCollege-IE`, scoped to the
one repo, Contents: Read and write.

## Architecture map

- `lib/github.ts` — read/write `data/projects.json` via Contents API. Writes
  send the file SHA (optimistic lock); errors carry `.status`.
- `app/api/projects/route.ts` — GET returns `{data, sha}`; PUT saves
  `{data, sha}`, returns real 409 on stale SHA.
- `components/DashboardProvider.tsx` — the hub. Client working copy, optimistic
  updates, 900ms debounced save, **409 auto-recovery** (refetch SHA, retry
  once, last-writer-wins), fresh data+SHA fetch on mount, multi-level undo
  (25 deep), viewed-day state, settings access. "today" is client-resolved
  (Vercel servers are UTC).
- `lib/types.ts` / `lib/data.ts` / `lib/mutations.ts` — types, pure helpers
  (deadlines, stats, day math, recurrence advance), pure mutations. Mutations
  stamp `lastTouched`; task completion stamps `completedAt`.
- UI sections on `app/page.tsx`: `GlanceHeader` (stat chips, Undo, Export CSV,
  Settings), `DailySchedule` (day nav ‹›, dnd-kit drag reorder),
  `UpcomingDeadlines` (7/14/30/90-day window), `StaleProjects` (threshold from
  settings), `Backlog` (search/sort/tag filter, priority + weekly/monthly
  recurrence on tasks, tags on projects), `StatsSection` (progress bars),
  `Assistant` (floating chat).
- `components/Assistant.tsx` + `lib/assistant.ts` + `app/api/assistant/route.ts`
  — Claude assistant (model from settings, default `claude-sonnet-4-6`). Tools
  are PROPOSALS ONLY: rendered as Apply/Skip cards; Apply runs through the
  normal dashboard actions. Quick prompts: Plan my day / Prioritize / Find
  overlaps. Shows per-message cost estimate.
- `app/api/cron/reminders/route.ts` + `vercel.json` — daily (12:00 UTC) email
  digest of overdue/next-2-day deadlines via nodemailer + Gmail SMTP. Graceful
  no-op until env vars + a reminder email (app Settings) are set. Honors
  `CRON_SECRET` as Bearer if present.
- Settings live IN the data JSON (`settings` key): staleAfterDays, default
  block start/length, assistantModel, reminderEmail.
- Schema: `schema/projects.schema.json` (kept in sync with `lib/types.ts`);
  example data in `schema/example-data.json`.

## Data model quick reference

Project: slug (stable id), title, description, status (active/paused/complete),
lastTouched, dueDate? (free text or ISO), tags?[], tasks?[] (backlog),
blocks[] (scheduled). Task/Subtask: id, title, done, dueDate? (ISO or fuzzy
text like "Summer 2026"), priority? (high/medium/low), recurrence?
(weekly/monthly; completing spawns next occurrence), completedAt?. Block: id,
date (YYYY-MM-DD), startTime/endTime (HH:MM), status
(planned/in_progress/complete), order, subtasks[].

Fuzzy due dates are intentional (kept verbatim, never flagged overdue).
"Schedule" moves a backlog task into a block on the viewed day; "Move to
backlog" reverses it.

## Open items / known state

1. **Rotate the GitHub PAT.** It briefly sat in `.env.example` early in
   development (never pushed, but cautious practice says rotate). Update
   `.env.local` + Vercel `GITHUB_TOKEN` when done. Also note PATs expire (org
   default ~90 days): when saves start failing with 401, this is why.
2. **Email reminders dormant** until the AUTH_EMAIL_* / CRON_SECRET env vars
   are set in Vercel and a reminder email is saved in app Settings. Cron
   schedule is daily 12:00 UTC in `vercel.json`.
3. One legacy subtask title contains "(due 6/18/26)" as text inside an ACS
   Working Group block subtask; Rob can clean it via Edit in the UI.
4. Mobile polish was a light pass only (responsive padding); a fuller pass is
   possible future work.
5. Skipped on purpose (Rob agreed): multi-user/auth, time tracking.

## Verification habits used here

- `npx tsc --noEmit` then `npx next build` before any deploy.
- Preview server via `.claude/launch.json` (root workbench folder) named
  `project-dashboard`; avoid clicking through flows that mutate live data
  unless intended; restore data afterward if testing writes.
- After deploy: curl the live URL for expected markers and check
  `/api/projects` (GET) and 409 behavior (PUT with bogus SHA) if relevant.
