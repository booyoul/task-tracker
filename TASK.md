# Smart Task Flow Task

Last updated: 2026-07-28

## Startup

- Use this `TASK.md` as the source of truth for current state and next work.
- Avoid full reads of `index.html` and `js/app.js`; search first with `rg`.
- Because this app uses legacy global scripts, search for duplicate function/global declarations before editing one.
- Keep changes small and consistent with existing patterns, even when a different AI model is used.
- After an Antigravity model switch, continue from current files and git status, not from model memory.

## Current State

- Status: Personal To-do implementation, production rule publication, authenticated production To-do CRUD/isolation, tracker ACL role checks, rich-note formatting/browser/production-write QA, automated Chrome desktop/mobile verification, and the production user-document/activity audit are complete. No required operational verification remains.
- Main app: `/home/booyoul/projects/task-tracker-main`
- Task file: `TASK.md`
- Project rules: `.agents/AGENTS.md`

## Project Shape

- Static HTML/JavaScript task tracker backed by Firebase/Firestore.
- JavaScript files are loaded as browser globals from `index.html`; script order and cache query strings matter.
- Each approved user has a tracker-independent personal To-do view backed by individual `todos` documents; other users and admins cannot read those private items.
- Personal To-do supports separate create/edit input, start/end dates, today/7-day/current-month/overdue filters, completion/search filters, and a once-per-session entry reminder with an optional daily dismissal.
- To-do documents accept an optional `taskLink` reference (`trackerId`, `taskId`, optional `subTaskId`/`occurrenceKey`) for future task integration, but dates and completion remain independent and no linking UI is active yet.
- Mobile calendar, list, monthly summary, KPI badge/settings, activity timeline, and mobile smoke QA are implemented.
- Trackers open in the yearly calendar view by default; users can still switch to monthly calendar, monthly summary, list, or Kanban views.
- KPI/Risk 현황, 검색, 상태·우선순위·담당자·마감 월 필터는 하나의 통합 제어 영역에 있으며, CSV/Excel/Power BI/백업/가져오기는 기본 접힌 `도구` 메뉴에 있다.
- `새 업무 추가`는 목록/캘린더/칸반/승인 관리 뷰 전환 행에 배치된다.
- Undo, batch delete, and bulk-action controls appear only in task-selectable list and Kanban views; calendar and admin views keep any selection or deletion history hidden until returning to a supported view.
- Tasks and sub tasks support a `CANCELLED` status shown as `취소`; cancelled items remain visible but are excluded from overdue, risk, progress, and completion-rate denominators.
- Monthly summary is optimized for progress-note review with note-first layout, task-grouped note cards, author/work-type/search filters, important/comment toggles, and review labels for results, issues, decisions, and follow-up.
- Monthly-summary notes group by their exact task or sub task ID and sort newest-first; the note detail panel shows older notes from only that exact task as read-only history while editing only the selected note.
- Existing main tasks and sub tasks open their progress-note composer from a pin beside the task title; the note detail panel identifies the linked main task and sub task.
- Progress notes support a user-selected `noteDate`; existing notes fall back to `createdAt`, while feeds and monthly summaries use the effective record date.
- Progress notes support sanitized preset/custom font colors, selectable bullet styles, and hierarchical bullets using `Tab`/`Shift+Tab`, plus customer name, Opp No, and a memo-level work type; monthly review search and cards include this context.
- Review comments are appended to each progress note by users with tracker update permission and appear in the note detail panel and monthly-review comment counts.
- Memo work types are configured per tracker through a separate owner/admin setting; existing task-level `taskType` values remain stored for compatibility but are no longer edited or displayed as task metadata.
- Task `industry` is presented as `업무 분류` at the top of the registration form; owner/admin users manage its options per tracker through `분류 설정`.
- List and desktop/mobile calendar views group work in the fixed hierarchy `업무 분류 → 본 태스크 → 서브 태스크`.
- The desktop list header can open or fold all sub tasks for the currently filtered tasks while preserving explicit fold state; desktop and mobile list titles use pin buttons to open the linked note composer and history, show exact-task note counts that open the latest note, and omit per-task delete buttons.
- New trackers store per-user `view/create/update/delete` permissions in `accessControl`; owners and admins retain full access, while legacy trackers keep their previous behavior until ACL settings are explicitly changed.
- Sub task recurrence input, schema normalization, calendar/monthly summary occurrence rendering, and flat export rows are implemented.
- Recurring sub task occurrences can store per-cycle status overrides on the source sub task through `recurrenceCompletions`; status can be edited from the task modal or monthly summary, and yearly calendar views group occurrences from the same source sub task into one lane.
- Tailwind dark mode is class-based via `.dark`, not OS preference.
- Firestore batch writes for task restore and tracker ordering stay in `js/task-service.js`; render/orchestration code does not write directly.
- Users with tracker view access can copy its active tasks and embedded sub tasks into a new tracker they own; task notes, progress notes, activity history, deleted tasks, and the source ACL are excluded.
- Tailwind CSS generation uses the locally pinned 4.3.2 CLI for reproducible output.
- Firefox desktop uses a custom year/month picker fallback for the due-month filters while Chrome and Edge keep their native month controls.
- The desktop monthly calendar compacts lanes independently for each week so inactive category/task rows do not leave vertical gaps.

## Key Files

- `index.html`: UI structure and script order/cache versions.
- `js/state.js`: global task/tracker/user state.
- `js/app.js`: main render/update flow and filters. Search before reading.
- `js/task-service.js`: Firestore CRUD and listeners.
- `js/todo-service.js`: personal To-do normalization, CRUD, and owner-scoped realtime listener.
- `js/todo-controller.js`: To-do date grouping, dedicated view/modal rendering, and entry reminder.
- `js/modal-controller.js`: task and KPI modals.
- `js/month-picker-controller.js`: Firefox fallback for desktop and mobile due-month filters.
- `js/calendar-*.js`: calendar, Gantt, and monthly summary renderers.
- `js/table-mobile-renderer.js`: mobile/list rendering.
- `docs/mobile_qa_checklist.md`: manual mobile QA checklist.
- `scripts/mobile-smoke.js`: automated mobile smoke checks.
- `scripts/todo-browser-smoke.js`: headless Chrome desktop/mobile To-do interaction and layout check.

## Verification

- CSS build: `npm run build:css`
- Mobile regression: `npm run smoke:mobile`
- Security contract: `npm run smoke:security`
- Tracker access UI: `npm run smoke:access`
- Note detail history: `npm run smoke:notes`
- Personal To-do: `npm run smoke:todo`
- Personal To-do real browser: `npm run smoke:todo:browser`
- Firestore Rules Emulator: `npm run test:rules`
- Combined regression: `npm test`
- JS syntax: `node --check path/to/file.js`
- Whitespace: `git diff --check`

## Recent Completed Work

- Firestore rules now require approved users, prevent self-promotion to admin, enforce task/tracker ownership, and validate note/activity authorship for both standard and environment-scoped collections.
- Tracker owners can grant approved users separate task view, create, update, and delete rights; client rendering/listeners and Firestore rules enforce the same ACL contract.
- Missing user documents now enter approval-pending state, authentication lookup failures fail closed, and legacy ownerless tasks are editable only by admins.
- `npm run smoke:security` guards the approval, role, ownership, and legacy-write contracts.
- Task and tracker CRUD now mutate local state and show caller success messages only after Firestore confirms the write; `npm run smoke:crud` covers failed add/update/delete behavior.
- Tracker copy writes the new tracker and up to 499 active tasks in one Firestore batch so failed copies leave no partial local or remote state.
- Java 21, Firebase CLI, and `@firebase/rules-unit-testing` now run 55 allow/deny scenarios against the actual Firestore Emulator using the isolated `demo-task-tracker-security` project ID.
- Production project `task-tracker-99af4` denied unauthenticated reads to `tasks`, `trackers`, `users`, `activity_logs`, and `progress_notes` after the user published the rules.
- Sub task execution cycle support is implemented end to end for input, schema normalization, calendar/monthly summary occurrence rendering, flat export rows, and per-cycle status overrides.
- Task modal and monthly summary let recurring sub task occurrences be checked independently while preserving the source sub task's default status.
- Monthly summary progress notes are automatically classified for review into results, issues, decisions, follow-up, and general notes.
- Duplicate legacy mobile/monthly renderer globals and the stale patch instruction file were removed.
- Mobile/list/calendar/summary QA coverage remains available through `npm run smoke:mobile`, including a 390px annual Gantt layout-width regression check.
- The note side panel provides exact-task history without changing the selected note ID used by update and delete operations.
- The note editor stores plain text for search/review classification and sanitized rich HTML for color/list rendering; existing plain-text notes continue to render normally.
- Customer name, Opp No, memo work type, review comments, and tracker-level work-type add/edit/delete settings are covered by note/CRUD/mobile/rules smoke tests.
- Tracker-level task-category settings, registration-form placement, category-first list/calendar grouping, and tracker-copy preservation are covered by mobile/CRUD smoke tests.
- Monthly-summary memo filtering supports author, work type, search, important-only, and comment-present combinations; mobile smoke covers the work-type and comment controls.
- Personal To-do uses separate per-item Firestore documents, owner-only standard/environment rules, dedicated desktop/mobile-safe UI, date-overlap filters, completion CRUD, and entry reminders.
- `npm run smoke:todo` covers failed-write preservation, future `taskLink` normalization, date-boundary grouping, overdue-first today rendering, and To-do/task-view isolation; the Firestore emulator suite now covers 55 scenarios including private To-do ownership and linked-reference writes.
- The user published the To-do Firestore rules; an unauthenticated production REST read of `todos` returned `403 PERMISSION_DENIED`.
- Approved production user A completed personal To-do create/read/update/complete/list/delete checks, while approved admin B was denied cross-user single reads, list queries, updates, and deletes; the temporary test record was removed.
- Production tracker ACL checks passed for owner, view-only, creator, editor, deleter, no-access, and admin behavior, including soft-delete/restore and hard-delete paths. A second pass used six isolated disposable Firebase Auth accounts; all Auth accounts, user documents, trackers, and tasks were removed, and the production user count returned to its baseline.
- Headless Chrome verifies desktop/mobile note selection, colors, bullet lists, work-type settings, review comments, and responsive layout; production A/B checks verify formatted note CRUD and admin review-comment persistence, with all temporary data removed.
- The read-only production user audit found 10 approved documents: eight users and two expected admins, with no duplicate emails, schema issues, or unexpected admins. The seven additional corporate users all have active tracker/task, note, activity-log, or ACL participation records, so their approved status was retained without modification.
- `npm run smoke:todo:browser` verifies rendered desktop and 390×844 mobile layout, add/edit/complete/delete interactions, date filtering, entry reminder/daily dismissal, and returning to the task view in headless Chrome. It uses mocked CRUD and does not prove authenticated production writes.
- Task/To-do view routing restores both CSS display and native `hidden` state for list, calendar, Kanban, admin, and To-do views; the Chrome smoke checks desktop and mobile task-view restoration so the task list cannot remain hidden after To-do routing.
- The legacy full-size KPI card section stays hidden after task/To-do routing; the compact status-filter chips remain visible in task views and are covered by Chrome smoke.

## Next Work

- To-do/task linking through the existing optional `taskLink` is intentionally deferred; wait for the user's next priority before resuming it.

## Cautions

- Do not add duplicate global function or variable names.
- Do not read or rewrite large files wholesale for small UI changes.
- Do not change script architecture or split globals into modules unless explicitly requested.
- When changing loaded JS/CSS, update the relevant query-string cache version in `index.html`.
- Keep `data-note-list-style` allowed in both note sanitizers so saved hierarchical bullet styles render in the detail panel and monthly summary.
- Personal To-do is private to `ownerId`; do not grant admins implicit read access or expose cached task titles after linked-task access is lost.
- Task/tracker copy must not copy personal To-do, and deleting a linked task must not delete the independent To-do.
- A single tracker copy is limited to 499 active tasks by Firestore's 500-write batch limit.
- Deleting or renaming a memo work type does not rewrite old notes; each note keeps its saved work-type label for historical display.
- Renaming a task category changes its display across the current tracker; deleting one removes it from future selection while tasks already using it keep their saved `industryLabel`.
