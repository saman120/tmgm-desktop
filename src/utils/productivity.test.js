import {
  getWeekStart,
  getWeekKey,
  getExpectedDaySlots,
  getExpectedWeekSlots,
  getExpectedHourSlots,
  getEstimatedSlots,
  getActualMinutes,
  getEstimationAccuracy,
  wasTaskPlanned,
  getStatusTransitionUpdates,
  buildTaskStats,
  computeProductivityScore,
  summarizeBucket,
  TOTAL_EXPECTED_DAILY_SLOTS,
  WORK_SLOTS_PER_HOUR,
} from './productivity';

// 2026-10-07 is a Wednesday.
const at = (day, h, m = 0) => new Date(2026, 9, day, h, m);
const completedTask = (overrides) => ({ status: 'completed', ...overrides });

describe('week helpers', () => {
  it('starts weeks on Monday', () => {
    expect(getWeekKey(at(7, 12))).toBe('2026-10-05');
    expect(getWeekKey(at(5, 0, 1))).toBe('2026-10-05');
    expect(getWeekKey(at(11, 23))).toBe('2026-10-05'); // Sunday
    expect(getWeekKey(at(12, 1))).toBe('2026-10-12');
    expect(getWeekStart(at(7, 12)).getHours()).toBe(0);
  });
});

describe('expected slots', () => {
  it('expects nothing on weekends or future days', () => {
    expect(getExpectedDaySlots(at(10, 0), at(10, 15))).toBe(0); // Saturday
    expect(getExpectedDaySlots(at(8, 0), at(7, 15))).toBe(0);
  });

  it('expects the full day for past weekdays and elapsed hours for today', () => {
    expect(getExpectedDaySlots(at(6, 0), at(7, 15))).toBe(TOTAL_EXPECTED_DAILY_SLOTS);
    expect(getExpectedDaySlots(at(7, 0), at(7, 8))).toBe(0);
    expect(getExpectedDaySlots(at(7, 0), at(7, 10, 30))).toBe(16);
  });

  it('sums weekdays for the week', () => {
    // Wed 10:30 → Mon + Tue full, Wed two hours.
    expect(getExpectedWeekSlots(getWeekStart(at(7, 10, 30)), at(7, 10, 30))).toBe(2 * TOTAL_EXPECTED_DAILY_SLOTS + 16);
  });

  it('expects work-phase slots per hour', () => {
    const now = at(7, 11, 27);
    expect(getExpectedHourSlots(at(7, 10), now)).toBe(WORK_SLOTS_PER_HOUR);
    expect(getExpectedHourSlots(at(7, 11), now)).toBe(3);
    expect(getExpectedHourSlots(at(7, 11), at(7, 11, 12))).toBe(0);
    expect(getExpectedHourSlots(at(7, 12), now)).toBe(0);
    expect(getExpectedHourSlots(at(7, 20), at(7, 21))).toBe(0);
  });
});

describe('task timing', () => {
  it('defaults and clamps the estimate', () => {
    expect(getEstimatedSlots({})).toBe(1);
    expect(getEstimatedSlots({ estimatedSlots: 3 })).toBe(3);
    expect(getEstimatedSlots({ estimatedSlots: 99 })).toBe(6);
    expect(getEstimatedSlots({ estimatedSlots: 0 })).toBe(1);
  });

  it('measures actual minutes, ignoring missing or stale data', () => {
    expect(getActualMinutes({ inProgressAt: at(7, 10, 15), completedAt: at(7, 10, 22) })).toBe(7);
    expect(getActualMinutes({ completedAt: at(7, 10, 22) })).toBeNull();
    expect(getActualMinutes({ inProgressAt: at(7, 10), completedAt: at(7, 9) })).toBeNull();
    expect(getActualMinutes({ inProgressAt: at(6, 10), completedAt: at(7, 10) })).toBeNull();
  });

  it('scores estimate accuracy symmetrically', () => {
    expect(getEstimationAccuracy({ inProgressAt: at(7, 10, 15), completedAt: at(7, 10, 20) })).toBe(1);
    expect(getEstimationAccuracy({ inProgressAt: at(7, 10, 15), completedAt: at(7, 10, 25) })).toBe(0.5);
    expect(getEstimationAccuracy({ estimatedSlots: 2, inProgressAt: at(7, 10, 15), completedAt: at(7, 10, 20) })).toBe(0.5);
    expect(getEstimationAccuracy({})).toBeNull();
  });

  it('treats tasks created before the work phase as planned', () => {
    expect(wasTaskPlanned({ createdAt: at(7, 10, 12), inProgressAt: at(7, 10, 30) })).toBe(true);
    expect(wasTaskPlanned({ createdAt: at(6, 17), inProgressAt: at(7, 10, 30) })).toBe(true);
    expect(wasTaskPlanned({ createdAt: at(7, 10, 25), inProgressAt: at(7, 10, 30) })).toBe(false);
    // Overtime start at 11:05 belongs to the 10:15 work phase.
    expect(wasTaskPlanned({ createdAt: at(7, 10, 20), inProgressAt: at(7, 11, 5) })).toBe(false);
    expect(wasTaskPlanned({ inProgressAt: at(7, 10, 30) })).toBeNull();
  });

  it('stamps timestamps on status transitions only', () => {
    const now = at(7, 10, 30);
    expect(getStatusTransitionUpdates({ status: 'pending' }, 'in-progress', now)).toEqual({ inProgressAt: now.toISOString() });
    expect(getStatusTransitionUpdates({ status: 'in-progress' }, 'completed', now)).toEqual({ completedAt: now.toISOString() });
    expect(getStatusTransitionUpdates({ status: 'in-progress' }, 'in-progress', now)).toEqual({});
    expect(getStatusTransitionUpdates({ status: 'in-progress' }, 'hold', now)).toEqual({});
    expect(getStatusTransitionUpdates({ status: 'pending' }, undefined, now)).toEqual({});
  });
});

describe('buildTaskStats', () => {
  const tasks = [
    completedTask({ inProgressAt: at(7, 10, 15), completedAt: at(7, 10, 20), createdAt: at(7, 10, 11), distractionCount: 2 }),
    completedTask({ inProgressAt: at(7, 10, 20), completedAt: at(7, 10, 30), createdAt: at(7, 10, 18) }),
    completedTask({ inProgressAt: at(5, 9, 20), completedAt: at(5, 9, 25) }),
    { status: 'pending', inProgressAt: at(7, 10, 15) },
    completedTask({}),
  ];
  const stats = buildTaskStats(tasks);

  it('buckets completed tasks by day, hour and week', () => {
    expect(stats.daily['2026-10-07'].tasksCompleted).toBe(2);
    expect(stats.hourly['2026-10-07-10'].tasksCompleted).toBe(2);
    expect(stats.weekly['2026-10-05'].tasksCompleted).toBe(3);
    expect(stats.daily['2026-10-05'].tasksCompleted).toBe(1);
  });

  it('keeps the existing 1 + distractionCount slot weighting', () => {
    expect(stats.daily['2026-10-07'].totalCompleted).toBe(4);
    expect(stats.daily['2026-10-07'].distractions).toBe(2);
  });

  it('summarizes focus, accuracy and planning', () => {
    const summary = summarizeBucket(stats.daily['2026-10-07'], 16);
    expect(summary.focus).toBe(0.5);
    expect(summary.accuracy).toBe(0.75);
    expect(summary.planned).toBe(0.5);
    expect(summary.score).toBe(computeProductivityScore({ completed: 4, expected: 16, focus: 0.5, accuracy: 0.75 }));
  });
});

describe('computeProductivityScore', () => {
  it('weights throughput, focus and accuracy', () => {
    expect(computeProductivityScore({ completed: 8, expected: 8, focus: 1, accuracy: 1 })).toBe(100);
    expect(computeProductivityScore({ completed: 4, expected: 8, focus: 1, accuracy: 1 })).toBe(75);
    expect(computeProductivityScore({ completed: 0, expected: 8, focus: null, accuracy: null })).toBe(0);
  });

  it('renormalises when components are missing and is null with no data', () => {
    expect(computeProductivityScore({ completed: 8, expected: 8, focus: 0.5, accuracy: null })).toBe(83);
    expect(computeProductivityScore({ completed: 3, expected: 0, focus: 1, accuracy: null })).toBe(100);
    expect(computeProductivityScore({ completed: 0, expected: 0, focus: null, accuracy: null })).toBeNull();
  });
});
