// src/utils/taskDescriptionParser.js
// Shorthand for backdating/seeding a task's timing data by appending
// "###distractionCount,inProgressAt,completedAt" (HH:MM, today's date) to the description.
// A " ~N" token (before any ###) sets the estimate in 5-minute slots and is stripped.
// In the add form, "Goal >> step one; step two" breaks a big task into one task per step.
import { getLocalDayKey } from './dateUtils';
import { MAX_ESTIMATED_SLOTS } from './productivity';

const ESTIMATE_PATTERN = /\s*~(\d{1,2})(?=\s*(###|$))/;
const BREAKDOWN_SEPARATOR = '>>';

export const parseTaskShorthand = (rawDescription) => {
  let description = rawDescription;
  const data = {};

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
    const today = getLocalDayKey(new Date());
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
// with `goal`, otherwise a single parsed task.
export const parseTaskInput = (rawInput) => {
  const separatorIndex = rawInput.indexOf(BREAKDOWN_SEPARATOR);
  if (separatorIndex === -1) return [parseTaskShorthand(rawInput)];

  const goal = rawInput.slice(0, separatorIndex).trim();
  const steps = rawInput
    .slice(separatorIndex + BREAKDOWN_SEPARATOR.length)
    .split(';')
    .map(step => step.trim())
    .filter(Boolean);

  if (steps.length === 0) return [parseTaskShorthand(goal || rawInput)];
  return steps.map(step => ({ ...parseTaskShorthand(step), ...(goal ? { goal } : {}) }));
};
