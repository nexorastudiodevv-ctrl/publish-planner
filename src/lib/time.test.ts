import { describe, expect, it } from 'vitest';
import { formatScheduledAt, getPreReminderAt, safeTimezone } from './time';

describe('time helpers', () => {
  it('calculates a pre-reminder in UTC from an absolute scheduled time', () => {
    const scheduled = '2026-11-22T10:30:00.000Z';
    expect(getPreReminderAt(scheduled, 30).toISOString()).toBe('2026-11-22T10:00:00.000Z');
  });

  it('does not send a pre-reminder calculation for negative minutes', () => {
    expect(() => getPreReminderAt('2026-11-22T10:30:00Z', -1)).toThrow();
  });

  it('formats a time in the requested timezone using Arabic', () => {
    expect(formatScheduledAt('2026-11-22T19:30:00.000Z', 'Africa/Cairo')).toContain('9:30');
  });

  it('falls back to Cairo for an invalid timezone', () => {
    expect(safeTimezone('Invalid/Zone')).toBe('Africa/Cairo');
  });
});
