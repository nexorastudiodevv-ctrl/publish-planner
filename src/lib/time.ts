import { format, formatDistanceToNow, isBefore, startOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const DEFAULT_TIMEZONE = 'Africa/Cairo';

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('ar', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function safeTimezone(timezone: string | null | undefined): string {
  return timezone && isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
}

export function getLocalDateTimeInput(isoDate: string | Date, timezone: string) {
  const date = new Date(isoDate);
  return {
    date: formatInTimeZone(date, timezone, 'yyyy-MM-dd'),
    time: formatInTimeZone(date, timezone, 'HH:mm'),
  };
}

export function fromTimezoneInput(date: string, time: string, timezone: string): Date {
  return fromZonedTime(`${date}T${time}:00`, timezone);
}

export function formatScheduledAt(isoDate: string, timezone: string): string {
  return formatInTimeZone(new Date(isoDate), timezone, 'EEEE، d MMMM yyyy · h:mm a', {
    locale: ar,
  });
}

export function formatShortDate(isoDate: string, timezone: string): string {
  return formatInTimeZone(new Date(isoDate), timezone, 'd MMMM', { locale: ar });
}

export function formatRelative(isoDate: string): string {
  return formatDistanceToNow(new Date(isoDate), { addSuffix: true, locale: ar });
}

export function getDayKey(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

export function isOverdue(isoDate: string, now: Date, timezone: string): boolean {
  const todayStart = fromZonedTime(
    `${formatInTimeZone(now, timezone, 'yyyy-MM-dd')}T00:00:00`,
    timezone,
  );
  return isBefore(new Date(isoDate), todayStart);
}

export function formatLocalDate(date: Date): string {
  return format(date, 'yyyy-MM-dd', { locale: ar });
}

export function localStartOfDay(date: Date): Date {
  return startOfDay(date);
}

export function getPreReminderAt(scheduledAt: string | Date, remindBeforeMinutes: number): Date {
  const date = new Date(scheduledAt);
  if (!Number.isFinite(remindBeforeMinutes) || remindBeforeMinutes < 0) {
    throw new Error('reminder minutes invalid');
  }
  return new Date(date.getTime() - remindBeforeMinutes * 60 * 1000);
}
