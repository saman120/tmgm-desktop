import { parseTaskShorthand, parseTaskInput } from './taskDescriptionParser';

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
