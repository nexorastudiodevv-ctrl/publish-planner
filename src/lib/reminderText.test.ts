import { describe, expect, it } from 'vitest';
import { buildReminderText } from './reminderText';

describe('reminder Arabic text', () => {
  it('builds a pre-reminder with note', () => {
    const text = buildReminderText({
      kind: 'pre',
      contentTypeLabel: 'ريلز',
      platformLabel: 'إنستجرام',
      title: 'إطلاق المنتج',
      scheduledAt: '2026-11-22T19:30:00.000Z',
      timezone: 'Africa/Cairo',
      remindBeforeMinutes: 30,
      note: 'ارفع المقطع أولًا',
    });
    expect(text).toContain('بعد 30 دقيقة');
    expect(text).toContain('ريلز');
    expect(text).toContain('ملاحظة');
  });

  it('builds a final reminder without an empty note', () => {
    const text = buildReminderText({
      kind: 'final',
      contentTypeLabel: 'بوست',
      platformLabel: 'لينكدإن',
      title: 'تقرير الشهر',
      scheduledAt: '2026-11-22T19:30:00.000Z',
      timezone: 'Africa/Cairo',
      remindBeforeMinutes: 0,
      note: ' ',
    });
    expect(text).toContain('حان الآن');
    expect(text).not.toContain('ملاحظة');
  });
});
