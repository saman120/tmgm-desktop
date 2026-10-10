# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Full dev loop: react-scripts start (port 3840, see .env PORT) + wait-on + electron in dev mode
npm start            # React dev server only (no Electron shell)
npm run electron-dev # Launch Electron only, pointed at the already-running dev server (ELECTRON_IS_DEV=true)
npm run build        # CRA production build -> build/
npm run pack         # Build + electron-builder --dir (unpacked app, fast iteration on packaging)
npm run dist         # Build + electron-builder --publish=never -> dist/*.dmg
npm run build-mac    # Build + electron-builder --mac
npm test             # react-scripts test (Jest watch mode); unit tests live next to the pure helpers in src/utils/*.test.js
CI=true npm test -- --watchAll=false   # single run
```

There is no lint script defined; ESLint runs via `react-app`/`react-app/jest` config as part of `react-scripts` build/start.

## Architecture

TMGM is an Electron + React (CRA) desktop app for running a personal task/time-boxing system: each task is meant to take 5 minutes, and the app tracks how well that's respected plus a rolling day/hour productivity score.

### Process split

- `public/electron.js` — Electron main process. Creates the window (hides to tray instead of quitting on macOS, `app.isQuitting` flag controls real quit from the tray/dock menu), builds the tray and dock menus, and owns `setupNotificationTimer` (a `setInterval` aligned to the next 5-minute wall-clock boundary that is meant to push `check-in-progress-task` over IPC — note it's currently defined but not invoked in `ready-to-show`, so native OS notifications are effectively dormant even though the IPC handlers for them exist).
- `public/preload.js` — the only bridge between renderer and main (`contextIsolation: true`, `nodeIntegration: false`). Exposes `window.electronAPI`: `showNotification`, `focusWindow`, `hideWindow`, `getAppVersion`, `quitApp`, and subscriptions (`onCheckInProgressTask`, `onCompleteCurrentTask`, `onNotificationClicked`, `onTriggerAddTask`). Renderer code should go through this API rather than assuming Node/Electron globals.
- `src/` — the React renderer, built by CRA into `build/` and loaded via `file://` in production or `http://localhost:3840` in dev (`ELECTRON_IS_DEV` env var, not NODE_ENV, gates this).

### Data layer is local-first (`src/services/api.js`)

`localStorage` is parsed once into an in-memory cache; writes update the cache immediately and are JSON-serialised to disk on a 250 ms debounce (flushed on `pagehide`/`beforeunload`/hidden). `getStoredTasks`/`getStoredDaySummaries` return shallow copies — callers mutate before writing back. `getAllTasks` returns stored tasks immediately and reconciles via `refreshFromServer()` in the background (App listens with `subscribeToTasksRefreshed`); it only awaits the network on a first run with nothing stored. Local edits/deletes made while a refresh is in flight win over the server snapshot (`locallyTouchedAt` / `locallyDeleted`).

Every `taskAPI` method (`getAllTasks`, `createTask`, `updateTask`, `deleteTask`, `getDaySummaryByDate`, `updateDaySummaryByDate`) writes to `localStorage` (`tmgm_tasks`, `tmgm_day_summaries`) synchronously and returns immediately, then fires the matching HTTP call to `REACT_APP_API_BASE_URL` (default `http://localhost:3840`, separate from the CRA dev server port) in the background via `runInBackground`, reconciling storage when/if it resolves. Failures in the background sync are swallowed — the UI never blocks on or surfaces backend availability. Server copies are merged *over* the local record (`mergeServerRecord`) rather than replacing it, so client-only fields the backend may not persist (`estimatedSlots`, `goal`, newer day-summary fields) survive a sync; `getAllTasks` also keeps never-synced `local-*` tasks. `createTask`/`updateTask` stamp `createdAt`/`updatedAt` locally. When touching this layer, preserve the local-write-first / best-effort-remote-sync pattern; the app is designed to be fully usable offline.

### Task lifecycle and time-boxing model

- Status flow: `backlog`/`hold` → `pending` → `in-progress` → `completed`, cycled in `App.js`'s `handleStatusToggle` (`statusCycle` map) and set directly via the per-item action buttons in `TaskItem.js`. `App.updateTask` stamps `inProgressAt`/`completedAt` on status transitions (`getStatusTransitionUpdates`) so timing data exists offline; explicit values in the update win.
- Estimates: `estimatedSlots` (1–6 five-minute slots, default 1). Set with a trailing ` ~N` in the description (stripped) or by clicking the ⏳ badge on a task. >1 slot is a hint to break the task down.
- Breakdown: in the add form, `Big task >> step one; step two ~2; step three` creates one task per step, each tagged with `goal` (shown as a chip). Parsing lives in `utils/taskDescriptionParser.js` (`parseTaskInput` / `parseTaskShorthand`).
- Logging past work: `PastEntryForm.js` (opened from the 🕘 button next to "Add New Task", or the 🕘 action on a task, via App's `openPastEntry`) creates completed tasks with explicit `inProgressAt`/`completedAt` (breakdown steps laid back to back, marked `backfilled: true`, which excludes them from the "planned" metric), or marks/edits an existing task as completed at a past time.
- Manual ordering: tasks carry a numeric `order`; drag-and-drop in `TaskList.js` (`handleDrop`) recomputes it by averaging neighboring `order` values (or ±10 at the ends) and can also change `status` if dropped between differently-status'd neighbors (`App.handleReorder` applies both).
- `showRecent` toggle in `App.js` filters to "Recent Active" (last 14 days, excludes `hold`/`backlog`) vs "All Tasks".
- Encoding extra data through the description field: both `AddTaskForm.js` and `TaskItem.js`'s inline edit parse a `###` suffix on the typed description as `distractionCount,inProgressAt,completedAt` (comma-separated, times in `HH:MM` for today) — a shorthand for backdating/seeding a task's timing data without a dedicated form field. Both go through the shared `utils/taskDescriptionParser.js`.

### 5-minute cadence and color coding

- `TaskList.js` runs a `currentTime` tick (every 10s) and derives an hourly "phase" purely from the wall-clock minute: `rest` (0–9), `planning` (10–14), `working` (15–59) — or `overtime` framing if a task is still `in-progress` past minute 15. This phase drives the stat-pill display (`🌿 Rest` / `📝 Plan` / `🔥 Work`) and the "time left in this 5-min slot" pill.
- On every wall-clock multiple of 5 minutes, `playBlipSound()` plays `public/beep.mp3` (also triggered manually by clicking the stats bar, and by "Breathe" logging). This is a renderer-side `Audio()` call, independent of the (currently unused) main-process notification timer described above.
- Completed-task coloring (`TaskItem.js` `completedStyle`): a gradient built from two independent axes — `delayCount` (time overrun: purple if <0.5, green baseline, red-1/2/3 as it climbs past 2/5/10) and `distractionCount` (green baseline, yellow-1/2/3 past 1/5/10). Both counts and their color thresholds are also what `count-button` badges on each task display.
- Day/hour divider coloring in `TaskList.js` (`getDailyStyle` / `getHourlyStyle`) is a *separate* color scale (green→yellow→red based on completed-slot throughput vs. expected slots for the elapsed time), weighted-off for weekends/off-hours (before 9am/after 7pm), and neutral-grey for "before 10am with zero completions yet" so an idle morning doesn't read as red.

### Rendering performance

The list can hold thousands of tasks, so keep these invariants when editing:
- App callbacks passed down (`updateTask`, `handleStatusToggle`, …) must stay referentially stable — they read current tasks through `tasksRef` and use functional `setTasks`. `TaskItem` is `React.memo`'d; any new prop must be stable too (TaskList's drag handlers take the row `index` from TaskItem rather than being per-row closures).
- `TaskList` builds `layout` (dividers + visible task descriptors) in one memo keyed on data only; drag state is applied in a cheap second memo (`renderElements`).
- Sorting (`sortTaskList`) precomputes keys; `buildTaskStats` caches per-task derived values in a `WeakMap` keyed by task object (updates replace objects, so unchanged tasks aren't re-derived).
- Use the cached formatters in `utils/dateUtils.js` (`formatDayLabel`, …) instead of `toLocaleDateString` in render loops.
- `.task-item` uses `content-visibility: auto` and no `backdrop-filter`; view switches and day/hour collapse run in `startTransition`.

### Stats aggregation and progress metrics

All metric logic is pure and lives in `src/utils/productivity.js` (tested in `productivity.test.js`), including the official-window constants (9am–6pm, 8 slots/hr for days; 9 work-phase slots/hr for hours) and expected-slot helpers (`getExpectedDaySlots` — weekends/future = 0, `getExpectedHourSlots`, `getExpectedWeekSlots`). Weeks start Monday; `getWeekKey` is the Monday's `YYYY-MM-DD`.

`App.js`'s `taskStats` memo calls `buildTaskStats(tasks)` over *all* tasks (not the visible filter) — the single source of truth for `daily`, `hourly` (`${dayKey}-${hour}`) and `weekly` buckets. Day keys come from the shared `getLocalDayKey` in `utils/dateUtils.js`. Each bucket tracks `totalCompleted` (weighted `1 + distractionCount`, the number shown as "X/Y slots"), `tasksCompleted`, `distractions`, estimation-accuracy sums and planned counts. `summarizeBucket(bucket, expected)` derives:
- **focus** = tasks / (tasks + distractions)
- **estimate accuracy** = mean of `min(est, actual) / max(est, actual)` per task (actual = `completedAt − inProgressAt`, ignored if missing or > 4h)
- **planned** = share of tasks created before the work phase (:15) of the hour they were started in
- **score** (0–100) = 50% throughput vs. expected + 25% focus + 25% accuracy, renormalised when a component has no data; null when nothing to judge.

`TaskList.js` renders week dividers (score-coloured), day dividers (with score pill and metric tooltip) and hour dividers from these buckets, and the 📊 button opens `ProgressInsights.js` (Today-by-hour / This-week-by-day / 8-week trend + 7-day wellbeing averages from day summaries).

### Day summary

`DaySummaryForm.js` is a per-date form (keyed by the same `YYYY-MM-DD` day key) persisted through `taskAPI.getDaySummaryByDate` / `updateDaySummaryByDate`. Fields are declared once in the `SUMMARY_FIELDS` config array (toggle vs. numberBar, grouped into "Morning" and "DaySummary" sections, with `reverseColor` for fields where lower is better like stress/tiredness) — add new summary fields there rather than hand-rolling new form markup (groups: Morning, DaySummary, Habits; the Insights wellbeing grid picks them up automatically). The form also shows a read-only "Work (auto-calculated)" block from the `metrics` prop (`summarizeBucket` for that day). Slider colors are computed continuously via HSL hue interpolation (`getColorForValue`), not discrete thresholds like the task/stat coloring above.
