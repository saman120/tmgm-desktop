import { parseTaskShorthand } from './taskDescriptionParser';

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
