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
npm test             # react-scripts test (Jest/RTL watch mode); no test files currently exist in the repo
```

There is no lint script defined; ESLint runs via `react-app`/`react-app/jest` config as part of `react-scripts` build/start.

## Architecture

TMGM is an Electron + React (CRA) desktop app for running a personal task/time-boxing system: each task is meant to take 5 minutes, and the app tracks how well that's respected plus a rolling day/hour productivity score.

### Process split

- `public/electron.js` — Electron main process. Creates the window (hides to tray instead of quitting on macOS, `app.isQuitting` flag controls real quit from the tray/dock menu), builds the tray and dock menus, and owns `setupNotificationTimer` (a `setInterval` aligned to the next 5-minute wall-clock boundary that is meant to push `check-in-progress-task` over IPC — note it's currently defined but not invoked in `ready-to-show`, so native OS notifications are effectively dormant even though the IPC handlers for them exist).
- `public/preload.js` — the only bridge between renderer and main (`contextIsolation: true`, `nodeIntegration: false`). Exposes `window.electronAPI`: `showNotification`, `focusWindow`, `hideWindow`, `getAppVersion`, `quitApp`, and subscriptions (`onCheckInProgressTask`, `onCompleteCurrentTask`, `onNotificationClicked`, `onTriggerAddTask`). Renderer code should go through this API rather than assuming Node/Electron globals.
- `src/` — the React renderer, built by CRA into `build/` and loaded via `file://` in production or `http://localhost:3840` in dev (`ELECTRON_IS_DEV` env var, not NODE_ENV, gates this).

### Data layer is local-first (`src/services/api.js`)

Every `taskAPI` method (`getAllTasks`, `createTask`, `updateTask`, `deleteTask`, `getDaySummaryByDate`, `updateDaySummaryByDate`) writes to `localStorage` (`tmgm_tasks`, `tmgm_day_summaries`) synchronously and returns immediately, then fires the matching HTTP call to `REACT_APP_API_BASE_URL` (default `http://localhost:3840`, separate from the CRA dev server port) in the background via `runInBackground`, reconciling storage when/if it resolves. Failures in the background sync are swallowed — the UI never blocks on or surfaces backend availability. When touching this layer, preserve the local-write-first / best-effort-remote-sync pattern; the app is designed to be fully usable offline.

### Task lifecycle and time-boxing model

- Status flow: `backlog`/`hold` → `pending` → `in-progress` → `completed`, cycled in `App.js`'s `handleStatusToggle` (`statusCycle` map) and set directly via the per-item action buttons in `TaskItem.js`.
- Manual ordering: tasks carry a numeric `order`; drag-and-drop in `TaskList.js` (`handleDrop`) recomputes it by averaging neighboring `order` values (or ±10 at the ends) and can also change `status` if dropped between differently-status'd neighbors.
- `showRecent` toggle in `App.js` filters to "Recent Active" (last 14 days, excludes `hold`/`backlog`) vs "All Tasks".
- Encoding extra data through the description field: both `AddTaskForm.js` and `TaskItem.js`'s inline edit parse a `###` suffix on the typed description as `distractionCount,inProgressAt,completedAt` (comma-separated, times in `HH:MM` for today) — a shorthand for backdating/seeding a task's timing data without a dedicated form field. Keep this parsing logic in sync between the two components if it changes.

### 5-minute cadence and color coding

- `TaskList.js` runs a `currentTime` tick (every 10s) and derives an hourly "phase" purely from the wall-clock minute: `rest` (0–9), `planning` (10–14), `working` (15–59) — or `overtime` framing if a task is still `in-progress` past minute 15. This phase drives the stat-pill display (`🌿 Rest` / `📝 Plan` / `🔥 Work`) and the "time left in this 5-min slot" pill.
- On every wall-clock multiple of 5 minutes, `playBlipSound()` plays `public/beep.mp3` (also triggered manually by clicking the stats bar, and by "Breathe" logging). This is a renderer-side `Audio()` call, independent of the (currently unused) main-process notification timer described above.
- Completed-task coloring (`TaskItem.js` `completedStyle`): a gradient built from two independent axes — `delayCount` (time overrun: purple if <0.5, green baseline, red-1/2/3 as it climbs past 2/5/10) and `distractionCount` (green baseline, yellow-1/2/3 past 1/5/10). Both counts and their color thresholds are also what `count-button` badges on each task display.
- Day/hour divider coloring in `TaskList.js` (`getDailyStyle` / `getHourlyStyle`) is a *separate* color scale (green→yellow→red based on completed-slot throughput vs. expected slots for the elapsed time), weighted-off for weekends/off-hours (before 9am/after 7pm), and neutral-grey for "before 10am with zero completions yet" so an idle morning doesn't read as red.

### Stats aggregation

`App.js`'s `taskStats` memo is the single source of truth for both daily and hourly buckets: it walks completed tasks once, keys them by local day (`YYYY-MM-DD`, via the shared `getLocalDayKey` — this key format is duplicated in `App.js` and `TaskList.js` and must stay identical or dividers/stats will desync) and by `${dayKey}-${hour}`, and weights each task's contribution as `1 + distractionCount` rather than a flat 1. `TaskList.js` consumes these buckets to render both the collapsible day/hour dividers and the live "✅ completed/expected" pill for the current hour.

### Day summary

`DaySummaryForm.js` is a per-date form (keyed by the same `YYYY-MM-DD` day key) persisted through `taskAPI.getDaySummaryByDate` / `updateDaySummaryByDate`. Fields are declared once in the `SUMMARY_FIELDS` config array (toggle vs. numberBar, grouped into "Morning" and "DaySummary" sections, with `reverseColor` for fields where lower is better like stress/tiredness) — add new summary fields there rather than hand-rolling new form markup. Slider colors are computed continuously via HSL hue interpolation (`getColorForValue`), not discrete thresholds like the task/stat coloring above.
