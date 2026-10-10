import { getLocalDayKey } from './dateUtils';

describe('getLocalDayKey', () => {
  it('formats a plain date as YYYY-MM-DD', () => {
    expect(getLocalDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('pads single-digit months and days', () => {
    expect(getLocalDayKey(new Date(2026, 2, 3))).toBe('2026-03-03');
  });

  it('does not pad double-digit months and days', () => {
    expect(getLocalDayKey(new Date(2026, 10, 25))).toBe('2026-11-25');
  });

  it('accepts a date string or timestamp, matching new Date() coercion', () => {
    const date = new Date(2026, 5, 15, 14, 30);
    expect(getLocalDayKey(date.toISOString())).toBe(getLocalDayKey(date));
    expect(getLocalDayKey(date.getTime())).toBe(getLocalDayKey(date));
  });

  it('ignores the time-of-day component', () => {
    const morning = new Date(2026, 6, 20, 0, 1);
    const night = new Date(2026, 6, 20, 23, 59);
    expect(getLocalDayKey(morning)).toBe(getLocalDayKey(night));
  });
});
