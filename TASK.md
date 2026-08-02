# Smart Task Flow Task

Last updated: 2026-08-02

## Startup

- Treat this file as the current restart board and source of truth.
- Confirm `.agents/AGENTS.md`, this file, and `git status` before editing.
- Search with `rg` before reading large files such as `index.html` or `js/app.js`.
- This app uses browser-global scripts; check for duplicate globals and update the matching `index.html` cache query whenever a loaded JS/CSS file changes.
- Keep changes small and repo-native. Continue from current files after any model switch rather than relying on model memory.

## Current State

- The Firebase/Firestore task tracker, tracker ACL, personal To-do, progress-note review workflow, recurrence support, responsive calendars, and class-based dark theme are implemented.
- Production Firestore rules, authenticated To-do isolation, tracker-role permissions, formatted-note writes, and the user-document audit have been verified. Disposable verification data and accounts were removed.
- Desktop and mobile task/list/calendar/summary/To-do routing is covered by focused smoke tests. The full suite includes 60 Firestore Rules allow/deny cases.
- The latest UI pass aligned dark surfaces across calendars, lists, all modal/dialog panels, mobile task cards, and mobile 가입 승인 관리.
- The desktop task modal's subtask recurrence form and dynamically rendered occurrence-status rows use explicit dark surfaces, including the highlighted To-do-linked occurrence.
- The To-do list, filters, view toggles, cards, linked-task badges, and desktop/mobile month/year calendars use explicit dark surface and semantic status colors.
- Personal To-do can optionally link to an accessible tracker task or normal subtask for context and direct navigation.
- Personal To-do can select a specific occurrence of a recurring subtask and reopen that exact occurrence in the task modal.
- Commit `4856bb0` is pushed to `origin/main`. Firestore Rules release `f9af690a-362b-4b12-8d1f-288933f980b8` was deployed to `task-tracker-99af4` on 2026-08-02, and unauthenticated reads of `todos`, `tasks`, `trackers`, `users`, `activity_logs`, and `progress_notes` were denied in production.
- An authenticated production browser check selected one of four recurring occurrences, saved and reopened the To-do link, highlighted the exact occurrence in the task modal, and removed the disposable To-do record with zero matching records remaining.

## Product Contracts

### Tasks and trackers

- Trackers open in the yearly calendar view by default; monthly calendar, monthly summary, list, and Kanban remain available.
- List and desktop/mobile calendar views use `업무 분류 → 본 태스크 → 서브 태스크`.
- Tasks and subtasks persist `PENDING`, `PROGRESS`, `COMPLETED`, or `CANCELLED`. Cancelled items remain visible but are excluded from overdue, risk, progress, and completion-rate calculations.
- Mobile cards show calculated operational status such as `기한 초과`, while their status controls must reflect the persisted task status. Do not pass `OVERDUE` into the editable status selector.
- Tracker owners configure per-user `view/create/update/delete` access. Owners and admins retain full access; legacy trackers retain legacy behavior until ACL settings are explicitly saved.
- Users with view access may copy active tasks and embedded subtasks into a new tracker they own. Notes, history, deleted tasks, source ACL, and personal To-do items are excluded; one copy is limited to 499 tasks.
- Task restore and tracker ordering writes remain in `js/task-service.js`; renderers must not write directly to Firestore.

### Subtasks and recurrence

- Subtask recurrence is normalized through the existing schema and rendered in calendar, monthly summary, and exports.
- Per-cycle status overrides live in the source subtask's `recurrenceCompletions` map.
- Recurring instances from one source subtask share a yearly calendar lane.

### Progress notes

- Main tasks and subtasks open the note composer/history from the pin beside their title.
- Note history is isolated by exact task or subtask ID; selecting history must not change which note is edited.
- `noteDate` is the effective record date, with `createdAt` as the compatibility fallback.
- Notes preserve searchable plain text and sanitized rich HTML, preset/custom colors, list styles, `Tab`/`Shift+Tab` nesting, customer name, Opp No, memo work type, and review comments.
- Keep `data-note-list-style` allowed in both sanitizers.
- Monthly summary remains note-first and supports author, work-type, search, important-only, and comment-present filters.

### Personal To-do

- To-do records are private, owner-scoped documents; admins do not receive implicit read access.
- List and calendar are mutually exclusive subviews. Monthly/yearly calendars follow the task calendar's responsive patterns.
- Optional `taskLink` stores only `trackerId`, `taskId`, optional `subTaskId`, and `occurrenceKey`; task titles are resolved from currently accessible data and are never cached in the private To-do document.
- The To-do modal selects `트래커 → 본 업무 → 하위 과제`. Cards display the live `트래커 › 본 업무 › 하위 과제` path and open the linked task with the selected subtask highlighted.
- Selecting a recurring subtask reveals an optional occurrence selector with up to 12 occurrences nearest the To-do start date. A selected occurrence is stored as a `YYYY-MM-DD` `occurrenceKey`, appended to the live path, and highlighted in the expanded per-occurrence status list.
- Missing or inaccessible targets display `연결된 업무를 볼 수 없음` without leaking titles. Ordinary To-do edits preserve that reference until the owner explicitly unlinks or replaces it.
- Task and To-do dates/completion remain independent. Deleting or copying a task must not delete or copy personal To-do data.

### Responsive UI and dark theme

- Tailwind dark mode is controlled by the app's `.dark` class, not OS preference.
- The compact KPI/status controls are canonical; the legacy full-size dashboard stays hidden through task/To-do routing.
- Selection, undo, batch-delete, and bulk-action controls are visible only in task-selectable list and Kanban views.
- Every modal, dialog, and note slide-over uses the shared `data-theme-modal-panel` contract: `slate-900` panel, `slate-800` nested/input surfaces, `slate-700` borders, and a transparent alignment wrapper.
- Dark theme coverage includes task calendars and monthly summary, list risk/overdue rows and mobile cards, all modal surfaces, and mobile approval-management panels/cards/tabs/pagination.
- Status colors may retain muted semantic hues in dark mode, but large surfaces must not fall back to light `bg-white` or pale-only backgrounds.
- Mobile layouts should avoid horizontal scroll; use `390×844` as the fast narrow-screen browser check.

## Key Files

- `index.html`: UI structure, initial classes, script order, and cache versions.
- `js/state.js`: global application state and default view modes.
- `js/app.js`: orchestration, filtering, compact KPI, and common render flow.
- `js/task-service.js`: task/tracker Firestore CRUD, restore, and ordering.
- `js/table-mobile-renderer.js`: desktop list rows and mobile task cards/status controls.
- `js/calendar-*.js`: desktop/mobile calendar, Gantt, and monthly-summary rendering.
- `js/modal-controller.js`: task modal, subtasks, recurrence state, and note entry points.
- `js/admin-approvals.js`: approval-management tables, mobile cards, tabs, roles, and pagination.
- `js/todo-service.js`, `js/todo-controller.js`: private To-do storage, routing, filters, calendars, and reminder.
- `scripts/mobile-smoke.js`: integrated JSDOM regression for task/mobile/calendar/summary/dark-theme contracts.
- `scripts/todo-browser-smoke.js`: headless Chrome desktop/mobile To-do interaction and layout checks.
- `docs/mobile_qa_checklist.md`: small manual mobile verification checklist.

## Verification

- CSS build: `npm run build:css`
- Mobile regression: `npm run smoke:mobile`
- Security contract: `npm run smoke:security`
- CRUD behavior: `npm run smoke:crud`
- Tracker access UI: `npm run smoke:access`
- Note detail/history: `npm run smoke:notes`
- Personal To-do: `npm run smoke:todo`
- Personal To-do browser: `npm run smoke:todo:browser`
- Firestore Rules Emulator: `npm run test:rules`
- Combined regression: `npm test`
- Changed JavaScript: `node --check path/to/file.js`
- Whitespace: `git diff --check`

For responsive geometry, native picker behavior, rich-text selection, or color composition, add a real Chrome/Firefox check as appropriate; JSDOM alone does not prove these behaviors.

## Verified Release Baseline

- `npm test` passes, including 60 Firestore Rules cases.
- `npm run build:css`, relevant JavaScript syntax checks, and `git diff --check` pass.
- Headless Chrome has verified the main responsive workflows and the latest mobile dark-theme surfaces at a 390px viewport.
- Firestore production-write verification is historical evidence only; do not infer future production state without a fresh live check.

## Next Work

- No required release work remains. Select the next product improvement before changing behavior or data contracts.

## Cautions

- Do not introduce duplicate browser globals or change script order casually.
- Do not split the current browser-global architecture into modules unless explicitly requested.
- Do not expose private To-do data through task copies, admin access, cached task titles, or deleted-task cleanup.
- Do not copy notes/history/ACL when copying a tracker.
- Renaming a task category updates current display; deleting it affects future selection but preserves existing saved labels.
- Renaming or deleting a memo work type does not rewrite historical notes.
- Preserve Korean user-facing wording unless copy changes are requested.
