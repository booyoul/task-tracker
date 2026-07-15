# Smart Task Flow Task

Last updated: 2026-07-15

## Startup

- Use this `TASK.md` as the source of truth for current state and next work.
- Avoid full reads of `index.html` and `js/app.js`; search first with `rg`.
- Because this app uses legacy global scripts, search for duplicate function/global declarations before editing one.
- Keep changes small and consistent with existing patterns, even when a different AI model is used.
- After an Antigravity model switch, continue from current files and git status, not from model memory.

## Current State

- Status: Firestore authorization hardening and failed-write-safe task/tracker CRUD are complete; the user published the production rules and unauthenticated production reads are verified denied.
- Main app: `/home/booyoul/projects/task-tracker-main`
- Task file: `TASK.md`
- Project rules: `.agents/AGENTS.md`

## Project Shape

- Static HTML/JavaScript task tracker backed by Firebase/Firestore.
- JavaScript files are loaded as browser globals from `index.html`; script order and cache query strings matter.
- Mobile calendar, list, monthly summary, KPI badge/settings, activity timeline, and mobile smoke QA are implemented.
- Monthly summary is optimized for progress-note review with note-first layout, task-grouped note cards, author/type/search filters, and review labels for results, issues, decisions, and follow-up.
- Progress notes support a user-selected `noteDate`; existing notes fall back to `createdAt`, while feeds and monthly summaries use the effective record date.
- Sub task recurrence input, schema normalization, calendar/monthly summary occurrence rendering, and flat export rows are implemented.
- Recurring sub task occurrences can store per-cycle status overrides on the source sub task through `recurrenceCompletions`; status can be edited from the task modal or monthly summary, and yearly calendar views group occurrences from the same source sub task into one lane.
- Tailwind dark mode is class-based via `.dark`, not OS preference.

## Key Files

- `index.html`: UI structure and script order/cache versions.
- `js/state.js`: global task/tracker/user state.
- `js/app.js`: main render/update flow and filters. Search before reading.
- `js/task-service.js`: Firestore CRUD and listeners.
- `js/modal-controller.js`: task and KPI modals.
- `js/calendar-*.js`: calendar, Gantt, and monthly summary renderers.
- `js/table-mobile-renderer.js`: mobile/list rendering.
- `docs/mobile_qa_checklist.md`: manual mobile QA checklist.
- `scripts/mobile-smoke.js`: automated mobile smoke checks.

## Verification

- CSS build: `npm run build:css`
- Mobile regression: `npm run smoke:mobile`
- Security contract: `npm run smoke:security`
- Firestore Rules Emulator: `npm run test:rules`
- Combined regression: `npm test`
- JS syntax: `node --check path/to/file.js`
- Whitespace: `git diff --check`

## Recent Completed Work

- Firestore rules now require approved users, prevent self-promotion to admin, enforce task/tracker ownership, and validate note/activity authorship for both standard and environment-scoped collections.
- Missing user documents now enter approval-pending state, authentication lookup failures fail closed, and legacy ownerless tasks are editable only by admins.
- `npm run smoke:security` guards the approval, role, ownership, and legacy-write contracts.
- Task and tracker CRUD now mutate local state and show caller success messages only after Firestore confirms the write; `npm run smoke:crud` covers failed add/update/delete behavior.
- Java 21, Firebase CLI, and `@firebase/rules-unit-testing` now run 26 allow/deny scenarios against the actual Firestore Emulator using the isolated `demo-task-tracker-security` project ID.
- Production project `task-tracker-99af4` denied unauthenticated reads to `tasks`, `trackers`, `users`, `activity_logs`, and `progress_notes` after the user published the rules.
- Sub task execution cycle support is implemented end to end for input, schema normalization, calendar/monthly summary occurrence rendering, flat export rows, and per-cycle status overrides.
- Task modal and monthly summary let recurring sub task occurrences be checked independently while preserving the source sub task's default status.
- Monthly summary progress notes are automatically classified for review into results, issues, decisions, follow-up, and general notes.
- Mobile/list/calendar/summary QA coverage remains available through `npm run smoke:mobile`.

## Next Work

- Audit existing production user documents for unexpected `role: admin` or `status: approved` values created under the previous permissive rules.
- Run approved-user owner/admin create, update, delete, and restore checks against production Firestore.

## Cautions

- Do not add duplicate global function or variable names.
- Do not read or rewrite large files wholesale for small UI changes.
- Do not change script architecture or split globals into modules unless explicitly requested.
- When changing loaded JS/CSS, update the relevant query-string cache version in `index.html`.
