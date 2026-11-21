import { formatScheduledAt } from './time';

export type ReminderTextInput = {
  kind: 'pre' | 'final';
  contentTypeLabel: string;
  platformLabel: string;
  title: string;
  scheduledAt: string;
  timezone: string;
  remindBeforeMinutes: number;
  note?: string | null;
};

export function buildReminderText(input: ReminderTextInput): string {
  const lead = input.kind === 'pre'
    ? `⏰ بعد ${input.remindBeforeMinutes} دقيقة: نشر ${input.contentTypeLabel} على ${input.platformLabel} — «${input.title}» (${formatScheduledAt(input.scheduledAt, input.timezone)})`
    : `🚀 حان الآن موعد نشر ${input.contentTypeLabel} على ${input.platformLabel} — «${input.title}» (${formatScheduledAt(input.scheduledAt, input.timezone)})`;
  return input.note?.trim() ? `${lead}\n\nملاحظة: ${input.note.trim()}` : lead;
}
