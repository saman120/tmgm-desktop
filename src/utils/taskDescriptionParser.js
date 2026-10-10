// src/utils/taskDescriptionParser.js
// Shorthand for backdating/seeding a task's timing data by appending
// "###distractionCount,inProgressAt,completedAt" (HH:MM, today's date) to the description.
// A " ~N" token (before any ###) sets the estimate in 5-minute slots and is stripped.
// In the add form, "Goal >> step one; step two" breaks a big task into one task per step.
//
// Keywords start with "___" and end with "," and can go anywhere in the text:
//   ___at <when>,   log the task as already done at that time (see parseLoggedAt)
//   ___dist <n>,    distraction count
//   ___est <n>,     estimate in 5-minute slots
// e.g. "___at yesterday/14, ___dist 2, Fix login bug". Keywords that don't parse
// are left in the text so the mistake stays visible.
import { getLocalDayKey } from './dateUtils';
import { MAX_ESTIMATED_SLOTS } from './productivity';

const ESTIMATE_PATTERN = /\s*~(\d{1,2})(?=\s*(###|$))/;
const BREAKDOWN_SEPARATOR = '>>';
const KEYWORD_PATTERN = /___([a-z]+)\s*([^,]*?)\s*(?:,|$)/gi;

const UNIT_MS = { m: 60000, min: 60000, mins: 60000, h: 3600000, hr: 3600000, hrs: 3600000, d: 86400000, day: 86400000, days: 86400000 };
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// "14", "14:30", "2pm", "2:30 pm" → { hours, minutes, exact } (exact = minutes given)
const parseTimeOfDay = (text) => {
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  if (match[3]) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (match[3] === 'pm' ? 12 : 0);
  }
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes, exact: match[2] !== undefined };
};

// "today", "yesterday", "mon".."sun" (most recent, today included), "2026-10-09",
// "10-09" (month-day), "9" (day of month). Ambiguous past/future resolves to the past.
const parseDay = (text, now) => {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  if (text === 'today') return day;
  if (text === 'yesterday' || text === 'yday') {
    day.setDate(day.getDate() - 1);
    return day;
  }
  const weekday = WEEKDAYS.indexOf(text.slice(0, 3));
  if (weekday !== -1 && /^[a-z]+$/.test(text)) {
    day.setDate(day.getDate() - ((day.getDay() - weekday + 7) % 7));
    return day;
  }
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return new Date(+match[1], +match[2] - 1, +match[3]);
  match = text.match(/^(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const date = new Date(day.getFullYear(), +match[1] - 1, +match[2]);
    if (date > day) date.setFullYear(date.getFullYear() - 1);
    return date;
  }
  match = text.match(/^(\d{1,2})$/);
  if (match) {
    const date = new Date(day.getFullYear(), day.getMonth(), +match[1]);
    if (date > day) date.setMonth(date.getMonth() - 1);
    return date;
  }
  return null;
};

// When a task was done. Returns { date, exact } or null. `exact` is false when only an
// hour was given — the task is then slotted into that hour's next free 5 minutes.
//   "14" / "2pm" / "14:30"          today (yesterday if that time hasn't come yet)
//   "yesterday/14", "9/14:30"       [date]/[hour]  (also "yesterday 14")
//   "-1h", "30m ago", "-1d"         relative to now
//   "yesterday", "mon"              that day at the current time
export const parseLoggedAt = (value, now = new Date()) => {
  const text = value.trim().toLowerCase();
  if (!text) return null;

  const relative = text.match(/^-?\s*(\d+)\s*([a-z]+)(\s+ago)?$/);
  if (relative && UNIT_MS[relative[2]]) {
    return { date: new Date(now.getTime() - parseInt(relative[1], 10) * UNIT_MS[relative[2]]), exact: true };
  }

  const atTime = (day, time) => {
    const date = new Date(day);
    date.setHours(time.hours, time.minutes, 0, 0);
    return { date, exact: time.exact };
  };

  const timeOnly = parseTimeOfDay(text);
  if (timeOnly) {
    const result = atTime(now, timeOnly);
    if (result.date > now) result.date.setDate(result.date.getDate() - 1);
    return result;
  }

  const slash = text.lastIndexOf('/');
  const space = text.indexOf(' ');
  const splitAt = slash !== -1 ? slash : space;
  if (splitAt !== -1) {
    const day = parseDay(text.slice(0, splitAt).trim(), now);
    const time = parseTimeOfDay(text.slice(splitAt + 1).trim());
    return day && time ? atTime(day, time) : null;
  }

  // A bare number is always an hour (handled above), never a day of the month.
  const day = /^\d+$/.test(text) ? null : parseDay(text, now);
  return day ? atTime(day, { hours: now.getHours(), minutes: now.getMinutes(), exact: true }) : null;
};

// Pulls ___keyword value, pairs out of the text. Returns the fields and the remaining text.
export const extractKeywords = (raw, now = new Date()) => {
  const fields = {};
  const rest = raw.replace(KEYWORD_PATTERN, (match, keyword, value) => {
    const key = keyword.toLowerCase();
    const number = parseInt(value, 10);
    if (key === 'at') {
      const loggedAt = parseLoggedAt(value, now);
      if (!loggedAt) return match;
      fields.loggedAt = loggedAt;
    } else if (key === 'dist' && number >= 0 && /^\d+$/.test(value)) {
      fields.distractionCount = number;
    } else if (key === 'est' && number >= 1 && /^\d+$/.test(value)) {
      fields.estimatedSlots = Math.min(number, MAX_ESTIMATED_SLOTS);
    } else {
      return match;
    }
    return ' ';
  });
  return { fields, rest: rest.replace(/\s+/g, ' ').trim() };
};

export const parseTaskShorthand = (rawDescription, now = new Date()) => {
  const { fields, rest } = extractKeywords(rawDescription, now);
  // Leave the text untouched unless keywords were actually pulled out of it.
  let description = Object.keys(fields).length ? rest : rawDescription;
  const data = { ...fields };

  const estimateMatch = description.match(ESTIMATE_PATTERN);
  if (estimateMatch) {
    const slots = parseInt(estimateMatch[1], 10);
    if (slots >= 1) {
      data.estimatedSlots = Math.min(slots, MAX_ESTIMATED_SLOTS);
      description = description.replace(ESTIMATE_PATTERN, '');
    }
  }
  data.description = description;

  const split = description.split('###');
  if (split[1]) {
    const splitComma = split[1].split(',');
    const distractionCount = parseInt(splitComma[0], 10);
    const today = getLocalDayKey(now);
    const inProgressAt = splitComma[1] && new Date(`${today}T${splitComma[1]}`);
    const completedAt = splitComma[2] && new Date(`${today}T${splitComma[2]}`);

    if (distractionCount >= 0) {
      data.distractionCount = distractionCount;
    }
    if (inProgressAt) {
      data.inProgressAt = inProgressAt;
    }
    if (completedAt) {
      data.completedAt = completedAt;
    }
  }

  return data;
};

// Returns an array of task payloads: one per step for "Goal >> a; b; c", each tagged
// with `goal`, otherwise a single parsed task. Keywords written before ">>" apply to
// every step; a step's own keywords override them.
export const parseTaskInput = (rawInput, now = new Date()) => {
  const separatorIndex = rawInput.indexOf(BREAKDOWN_SEPARATOR);
  if (separatorIndex === -1) return [parseTaskShorthand(rawInput, now)];

  const { fields: shared, rest: goal } = extractKeywords(rawInput.slice(0, separatorIndex), now);
  const steps = rawInput
    .slice(separatorIndex + BREAKDOWN_SEPARATOR.length)
    .split(';')
    .map(step => step.trim())
    .filter(Boolean);

  if (steps.length === 0) return [{ ...shared, ...parseTaskShorthand(goal || rawInput, now) }];
  return steps.map(step => ({ ...shared, ...parseTaskShorthand(step, now), ...(goal ? { goal } : {}) }));
};
