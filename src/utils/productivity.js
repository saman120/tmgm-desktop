// src/utils/productivity.js - Pure time-boxing / progress metrics shared by the
// task list dividers, the progress insights panel and the day summary form.
import { getLocalDayKey } from './dateUtils';

export const SLOT_MINUTES = 5;
export const MAX_ESTIMATED_SLOTS = 6;

// Hourly phases, derived from the wall-clock minute.
export const PLANNING_PHASE_START_MINUTE = 10;
export const WORK_PHASE_START_MINUTE = 15;
export const WORK_SLOTS_PER_HOUR = (60 - WORK_PHASE_START_MINUTE) / SLOT_MINUTES; // 9

// Official working window used for the day divider's completed/expected slot count
export const OFFICIAL_START_HOUR = 9;
export const OFFICIAL_END_HOUR = 18; // 6 PM
export const SLOTS_PER_OFFICIAL_HOUR = 8;
export const OFFICIAL_HOURS_COUNT = OFFICIAL_END_HOUR - OFFICIAL_START_HOUR;
export const TOTAL_EXPECTED_DAILY_SLOTS = SLOTS_PER_OFFICIAL_HOUR * OFFICIAL_HOURS_COUNT;

// Durations above this are treated as stale (e.g. a task left in-progress overnight)
// rather than as a real estimate miss.
const MAX_TRACKED_MINUTES = 240;

const toMs = (value) => {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
};

export const isWeekendDate = (date) => {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
};

// The timestamp a completed task is bucketed under (start time, falling back to completion).
export const getTaskBucketTime = (task) => task.inProgressAt || task.completedAt || task.updatedAt;

// How many official hours have started so far: 0 before the window opens, growing by
// one each official hour, capped at the full count once the window has closed. Past
// days have the whole window behind them, so they're always compared against the full total.
// `referenceTime` must be the actual current clock time, not the (often midnight) date
// being rendered, so "today" only counts hours that have really elapsed.
export const getOfficialHoursElapsed = (referenceTime, isToday) => {
  if (!isToday) return OFFICIAL_HOURS_COUNT;
  const hour = referenceTime.getHours();
  if (hour < OFFICIAL_START_HOUR) return 0;
  if (hour >= OFFICIAL_END_HOUR) return OFFICIAL_HOURS_COUNT;
  return Math.min(OFFICIAL_HOURS_COUNT, hour - OFFICIAL_START_HOUR + 1);
};

// Expected slots for a calendar day as of `now`: weekends and future days expect nothing.
export const getExpectedDaySlots = (dayDate, now) => {
  if (isWeekendDate(dayDate)) return 0;
  const dayKey = getLocalDayKey(dayDate);
  const todayKey = getLocalDayKey(now);
  if (dayKey > todayKey) return 0;
  return SLOTS_PER_OFFICIAL_HOUR * getOfficialHoursElapsed(now, dayKey === todayKey);
};

// Expected slots for one hour of the official window: the 9 work-phase slots once the
// hour has passed, the slots started so far for the current hour, nothing otherwise.
export const getExpectedHourSlots = (hourDate, now) => {
  const hour = hourDate.getHours();
  if (isWeekendDate(hourDate) || hour < OFFICIAL_START_HOUR || hour >= OFFICIAL_END_HOUR) return 0;
  const hourStart = new Date(hourDate);
  hourStart.setMinutes(0, 0, 0);
  const elapsedMs = now.getTime() - hourStart.getTime();
  if (elapsedMs < 0) return 0;
  if (elapsedMs >= 60 * 60000) return WORK_SLOTS_PER_HOUR;
  const minute = now.getMinutes();
  return minute < WORK_PHASE_START_MINUTE ? 0 : Math.floor((minute - WORK_PHASE_START_MINUTE) / SLOT_MINUTES) + 1;
};

// Weeks start on Monday (local time).
export const getWeekStart = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

export const getWeekKey = (date) => getLocalDayKey(getWeekStart(date));

export const getWeekDays = (weekStart) => Array.from({ length: 7 }, (_, i) => {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + i);
  return d;
});

export const getExpectedWeekSlots = (weekStart, now) =>
  getWeekDays(weekStart).reduce((sum, day) => sum + getExpectedDaySlots(day, now), 0);

// ---- Per-task timing ----

export const getEstimatedSlots = (task) => {
  const slots = parseInt(task?.estimatedSlots, 10);
  return slots >= 1 ? Math.min(slots, MAX_ESTIMATED_SLOTS) : 1;
};

export const getActualMinutes = (task) => {
  const start = toMs(task?.inProgressAt);
  const end = toMs(task?.completedAt);
  if (start === null || end === null || end < start) return null;
  const minutes = (end - start) / 60000;
  return minutes > MAX_TRACKED_MINUTES ? null : minutes;
};

// 1 = finished exactly in the estimated time; drops symmetrically for over- and
// under-runs (finishing a 5 min task in 2.5 min or in 10 min both score 0.5).
export const getEstimationAccuracy = (task) => {
  const actual = getActualMinutes(task);
  if (actual === null) return null;
  const estimated = getEstimatedSlots(task) * SLOT_MINUTES;
  if (actual <= 0) return 0;
  return Math.min(estimated, actual) / Math.max(estimated, actual);
};

// A task counts as planned when it was created before the work phase of the hour in
// which it was started — i.e. during that hour's planning phase or earlier — rather
// than added ad hoc mid-work. Unknown (null) if either timestamp is missing, or if the
// task was logged after the fact (its createdAt says nothing about planning).
export const wasTaskPlanned = (task) => {
  if (task?.backfilled) return null;
  const created = toMs(task?.createdAt);
  const started = toMs(task?.inProgressAt);
  if (created === null || started === null) return null;
  const workPhaseStart = new Date(started);
  workPhaseStart.setMinutes(WORK_PHASE_START_MINUTE, 0, 0);
  if (workPhaseStart.getTime() > started) {
    // Started before :15 (overtime from the previous hour) — compare to that hour's work phase.
    workPhaseStart.setHours(workPhaseStart.getHours() - 1);
  }
  return created < workPhaseStart.getTime();
};

// Timestamps to stamp when a task changes status, so timing data exists even when the
// backend is unreachable. Explicit values passed in an update should take precedence.
export const getStatusTransitionUpdates = (task, newStatus, now = new Date()) => {
  if (!newStatus || task?.status === newStatus) return {};
  if (newStatus === 'in-progress') return { inProgressAt: now.toISOString() };
  if (newStatus === 'completed') return { completedAt: now.toISOString() };
  return {};
};

// ---- Aggregation ----

const emptyBucket = () => ({
  totalCompleted: 0,   // slot-weighted: each task counts 1 + distractionCount
  tasksCompleted: 0,
  distractions: 0,
  accuracySum: 0,
  accuracyCount: 0,
  plannedCount: 0,
  planKnownCount: 0,
});

// Per-task derived values, cached by task object. Updates replace task objects, so
// unchanged tasks are never re-derived when stats are rebuilt after an edit.
const derivedCache = new WeakMap();

const getTaskDerived = (task) => {
  let derived = derivedCache.get(task);
  if (derived) return derived;

  derived = null;
  const timestamp = task.status === 'completed' ? getTaskBucketTime(task) : null;
  const taskDate = timestamp ? new Date(timestamp) : null;
  if (taskDate && !Number.isNaN(taskDate.getTime())) {
    const dayKey = getLocalDayKey(taskDate);
    derived = {
      dayKey,
      hourKey: `${dayKey}-${taskDate.getHours()}`,
      weekKey: getWeekKey(taskDate),
      distractions: task.distractionCount || 0,
      accuracy: getEstimationAccuracy(task),
      planned: wasTaskPlanned(task),
    };
  }
  derivedCache.set(task, derived);
  return derived;
};

const addToBucket = (buckets, key, derived) => {
  if (!buckets[key]) buckets[key] = emptyBucket();
  const bucket = buckets[key];
  bucket.totalCompleted += 1 + derived.distractions;
  bucket.tasksCompleted += 1;
  bucket.distractions += derived.distractions;

  if (derived.accuracy !== null) {
    bucket.accuracySum += derived.accuracy;
    bucket.accuracyCount += 1;
  }

  if (derived.planned !== null) {
    bucket.planKnownCount += 1;
    if (derived.planned) bucket.plannedCount += 1;
  }
};

// Single pass over completed tasks, keyed by local day (YYYY-MM-DD), `${dayKey}-${hour}`
// and Monday-start week (the week's YYYY-MM-DD day key).
export const buildTaskStats = (tasks) => {
  const daily = {};
  const hourly = {};
  const weekly = {};

  tasks.forEach(task => {
    const derived = getTaskDerived(task);
    if (!derived) return;
    addToBucket(daily, derived.dayKey, derived);
    addToBucket(hourly, derived.hourKey, derived);
    addToBucket(weekly, derived.weekKey, derived);
  });

  return { daily, hourly, weekly };
};

// Weighted 0-100 score: 50% throughput vs. expected slots, 25% focus (tasks vs.
// distractions), 25% estimation accuracy. Components without data are left out and
// the remaining weights renormalised. Null when there's nothing to judge.
export const computeProductivityScore = ({ completed, expected, focus, accuracy }) => {
  const parts = [];
  if (expected > 0) parts.push([0.5, Math.min(1, completed / expected)]);
  else if (completed > 0) parts.push([0.5, 1]);
  if (focus !== null && focus !== undefined) parts.push([0.25, focus]);
  if (accuracy !== null && accuracy !== undefined) parts.push([0.25, accuracy]);
  if (parts.length === 0) return null;

  const weightSum = parts.reduce((s, [w]) => s + w, 0);
  const value = parts.reduce((s, [w, v]) => s + w * v, 0) / weightSum;
  return Math.round(value * 100);
};

export const summarizeBucket = (bucket, expected = 0) => {
  const b = bucket || emptyBucket();
  const focus = b.tasksCompleted > 0 ? b.tasksCompleted / (b.tasksCompleted + b.distractions) : null;
  const accuracy = b.accuracyCount > 0 ? b.accuracySum / b.accuracyCount : null;
  const planned = b.planKnownCount > 0 ? b.plannedCount / b.planKnownCount : null;
  return {
    completed: b.totalCompleted,
    tasks: b.tasksCompleted,
    distractions: b.distractions,
    expected,
    focus,
    accuracy,
    planned,
    score: computeProductivityScore({ completed: b.totalCompleted, expected, focus, accuracy }),
  };
};

export const formatPercent = (ratio) => (ratio === null || ratio === undefined ? '–' : `${Math.round(ratio * 100)}%`);

export const getScoreStyle = (score) => {
  if (score === null || score === undefined) return { background: 'var(--hover-bg)', color: 'var(--text-muted)' };
  if (score >= 80) return { background: 'var(--stat-green-1)', color: 'var(--stat-text-dark)' };
  if (score >= 65) return { background: 'var(--stat-green-2)', color: 'var(--stat-text-dark)' };
  if (score >= 50) return { background: 'var(--stat-yellow)', color: 'var(--stat-text-dark)' };
  if (score >= 35) return { background: 'var(--stat-red-1)', color: 'var(--stat-text-dark)' };
  return { background: 'var(--stat-red-2)', color: 'var(--stat-text-dark)' };
};

// Turns quick-added payloads for an hour into completed tasks laid into that hour's
// next free 5-minute slots: after the hour's latest completed task (or from the work
// phase at :15), kept inside the hour and never ending in the future. Explicit
// times from the ### shorthand win.
export const buildHourEntries = (payloads, hourDate, existingTasks, now = new Date()) => {
  const MINUTE_MS = 60000;
  const hourStart = new Date(hourDate);
  hourStart.setMinutes(0, 0, 0);
  const hourStartMs = hourStart.getTime();
  const hourEndMs = hourStartMs + 60 * MINUTE_MS;
  const hourKey = `${getLocalDayKey(hourStart)}-${hourStart.getHours()}`;
  const nowMs = now.getTime();

  let cursor = hourStartMs + WORK_PHASE_START_MINUTE * MINUTE_MS;
  existingTasks.forEach(task => {
    const derived = getTaskDerived(task);
    if (!derived || derived.hourKey !== hourKey) return;
    const end = toMs(task.completedAt) ?? toMs(getTaskBucketTime(task)) + SLOT_MINUTES * MINUTE_MS;
    if (end > cursor) cursor = end;
  });

  return payloads.map(payload => {
    const durationMs = getEstimatedSlots(payload) * SLOT_MINUTES * MINUTE_MS;
    const start = Math.max(hourStartMs, Math.min(cursor, hourEndMs - MINUTE_MS, nowMs - durationMs));
    const end = Math.min(start + durationMs, Math.max(nowMs, start));
    cursor = start + durationMs;
    return {
      status: 'completed',
      inProgressAt: new Date(start).toISOString(),
      completedAt: new Date(end).toISOString(),
      backfilled: true,
      ...payload,
    };
  });
};

// Converts parsed `loggedAt` markers (from "___at ...,") into completed-task timing.
// Exact times start there (consecutive steps with the same time run back to back);
// hour-only times go into that hour's next free slots via buildHourEntries. Payloads
// without `loggedAt` pass through unchanged.
export const resolveLoggedTimes = (payloads, existingTasks, now = new Date()) => {
  const created = [];
  const nowMs = now.getTime();
  let chain = null; // { key, end } for back-to-back exact steps

  return payloads.map(({ loggedAt, ...payload }) => {
    if (!loggedAt) return payload;

    let entry;
    if (loggedAt.exact) {
      const durationMs = getEstimatedSlots(payload) * SLOT_MINUTES * 60000;
      const key = loggedAt.date.getTime();
      const start = Math.min(chain && chain.key === key ? chain.end : key, nowMs - durationMs);
      chain = { key, end: start + durationMs };
      entry = {
        status: 'completed',
        inProgressAt: new Date(start).toISOString(),
        completedAt: new Date(start + durationMs).toISOString(),
        backfilled: true,
        ...payload,
      };
    } else {
      [entry] = buildHourEntries([payload], loggedAt.date, existingTasks.concat(created), now);
    }
    created.push(entry);
    return entry;
  });
};
