import { parseTaskShorthand, parseTaskInput, parseLoggedAt } from './taskDescriptionParser';

describe('parseTaskShorthand', () => {
  it('returns just the description when there is no ### shorthand', () => {
    expect(parseTaskShorthand('Write report')).toEqual({ description: 'Write report' });
  });

  it('parses a distraction count only', () => {
    const result = parseTaskShorthand('Write report###3');
    expect(result.description).toBe('Write report###3');
    expect(result.distractionCount).toBe(3);
    expect(result.inProgressAt).toBeUndefined();
    expect(result.completedAt).toBeUndefined();
  });

  it('parses distraction count plus inProgressAt', () => {
    const result = parseTaskShorthand('Write report###2,09:00');
    expect(result.distractionCount).toBe(2);
    expect(result.inProgressAt).toBeInstanceOf(Date);
    expect(result.inProgressAt.getHours()).toBe(9);
    expect(result.inProgressAt.getMinutes()).toBe(0);
    expect(result.completedAt).toBeUndefined();
  });

  it('parses all three fields: distractionCount, inProgressAt, completedAt', () => {
    const result = parseTaskShorthand('Write report###2,09:00,09:20');
    expect(result.distractionCount).toBe(2);
    expect(result.inProgressAt.getMinutes()).toBe(0);
    expect(result.completedAt.getMinutes()).toBe(20);
  });

  it('omits distractionCount when it does not parse to a non-negative number', () => {
    const result = parseTaskShorthand('Write report###abc,09:00');
    expect(result.distractionCount).toBeUndefined();
    expect(result.inProgressAt).toBeInstanceOf(Date);
  });

  it('omits distractionCount for negative values', () => {
    const result = parseTaskShorthand('Write report###-1,09:00');
    expect(result.distractionCount).toBeUndefined();
  });

  it('still produces a Date (possibly invalid) for a garbage time string, without throwing', () => {
    expect(() => parseTaskShorthand('Write report###1,not-a-time')).not.toThrow();
    const result = parseTaskShorthand('Write report###1,not-a-time');
    expect(result.inProgressAt).toBeInstanceOf(Date);
    expect(isNaN(result.inProgressAt.getTime())).toBe(true);
  });

  it('ignores extra ### occurrences beyond the first split', () => {
    const result = parseTaskShorthand('Write report###2,09:00###extra');
    expect(result.distractionCount).toBe(2);
    expect(result.inProgressAt.getHours()).toBe(9);
  });
});

describe('estimate shorthand (~N)', () => {
  it('parses and strips a trailing ~N estimate', () => {
    expect(parseTaskShorthand('Write report ~3')).toEqual({ description: 'Write report', estimatedSlots: 3 });
  });

  it('works alongside the ### timing shorthand', () => {
    const result = parseTaskShorthand('Write report ~2###1,09:00');
    expect(result.estimatedSlots).toBe(2);
    expect(result.description).toBe('Write report###1,09:00');
    expect(result.distractionCount).toBe(1);
  });

  it('clamps large estimates and ignores ~0 or mid-text tildes', () => {
    expect(parseTaskShorthand('Big ~40').estimatedSlots).toBe(6);
    expect(parseTaskShorthand('Nothing ~0')).toEqual({ description: 'Nothing ~0' });
    expect(parseTaskShorthand('About ~5 things')).toEqual({ description: 'About ~5 things' });
  });
});

describe('parseTaskInput', () => {
  it('returns a single task when there is no breakdown', () => {
    expect(parseTaskInput('Write report ~2')).toEqual([{ description: 'Write report', estimatedSlots: 2 }]);
  });

  it('breaks "Goal >> a; b; c" into one task per step tagged with the goal', () => {
    expect(parseTaskInput('Launch site >> buy domain; set up DNS ~2;  ; deploy')).toEqual([
      { description: 'buy domain', goal: 'Launch site' },
      { description: 'set up DNS', estimatedSlots: 2, goal: 'Launch site' },
      { description: 'deploy', goal: 'Launch site' },
    ]);
  });

  it('falls back to a single task when no steps follow >>', () => {
    expect(parseTaskInput('Launch site >>')).toEqual([{ description: 'Launch site' }]);
  });
});

describe('___keyword, syntax', () => {
  // Thursday 2026-10-08 15:40 local
  const now = new Date(2026, 9, 8, 15, 40);
  const local = (d, h, m = 0) => new Date(2026, 9, d, h, m);

  it('pulls ___at, ___dist and ___est out of the text, in any position', () => {
    const result = parseTaskShorthand('___at yesterday/14, ___dist 2, Fix login bug ___est 2,', now);
    expect(result.description).toBe('Fix login bug');
    expect(result.distractionCount).toBe(2);
    expect(result.estimatedSlots).toBe(2);
    expect(result.loggedAt).toEqual({ date: local(7, 14), exact: false });
  });

  it('accepts a missing trailing comma on the last keyword and is case-insensitive', () => {
    expect(parseTaskShorthand('Fix bug ___DIST 3', now)).toEqual({ description: 'Fix bug', distractionCount: 3 });
  });

  it('leaves unknown or unparseable keywords in the text', () => {
    expect(parseTaskShorthand('___at someday, Fix bug', now)).toEqual({ description: '___at someday, Fix bug' });
    expect(parseTaskShorthand('___foo 1, Fix bug', now)).toEqual({ description: '___foo 1, Fix bug' });
    expect(parseTaskShorthand('___dist x, Fix bug', now)).toEqual({ description: '___dist x, Fix bug' });
  });

  it('applies keywords before >> to every step', () => {
    const steps = parseTaskInput('___at 14, ___dist 1, Release >> tag; deploy ___dist 0,', now);
    expect(steps).toEqual([
      { loggedAt: { date: local(8, 14), exact: false }, distractionCount: 1, description: 'tag', goal: 'Release' },
      { loggedAt: { date: local(8, 14), exact: false }, distractionCount: 0, description: 'deploy', goal: 'Release' },
    ]);
  });
});

describe('parseLoggedAt', () => {
  const now = new Date(2026, 9, 8, 15, 40); // Thu
  const local = (mo, d, h, m = 0) => new Date(2026, mo - 1, d, h, m);

  it.each([
    ['14', local(10, 8, 14), false],
    ['14:30', local(10, 8, 14, 30), true],
    ['2pm', local(10, 8, 14), false],
    ['2:05 pm', local(10, 8, 14, 5), true],
    ['22', local(10, 7, 22), false],             // later than now → yesterday
    ['yesterday/14', local(10, 7, 14), false],
    ['yesterday 9:15', local(10, 7, 9, 15), true],
    ['today/9', local(10, 8, 9), false],
    ['mon/10', local(10, 5, 10), false],
    ['thu/10', local(10, 8, 10), false],          // today counts as the most recent Thursday
    ['5/16', local(10, 5, 16), false],            // day of month
    ['20/16', local(9, 20, 16), false],           // future day → previous month
    ['10-01/11:20', local(10, 1, 11, 20), true],
    ['2026-09-30/17', local(9, 30, 17), false],
    ['-1h', local(10, 8, 14, 40), true],
    ['30m ago', local(10, 8, 15, 10), true],
    ['-1d', local(10, 7, 15, 40), true],
    ['yesterday', local(10, 7, 15, 40), true],
  ])('%s', (value, date, exact) => {
    expect(parseLoggedAt(value, now)).toEqual({ date, exact });
  });

  it.each(['', 'someday', '25', '13pm', 'yesterday/xx', '-3w'])('rejects %p', (value) => {
    expect(parseLoggedAt(value, now)).toBeNull();
  });
});
