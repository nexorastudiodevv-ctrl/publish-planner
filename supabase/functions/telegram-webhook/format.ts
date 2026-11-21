import { fromZonedTime } from 'npm:date-fns-tz@3.2.0';
import type { ContentItem } from '../_shared/types.ts';

const defaultTimezone = 'Africa/Cairo';

const contentTypeLabels: Record<ContentItem['content_type'], string> = {
  video: 'فيديو',
  reel: 'ريلز',
  post: 'منشور',
  story: 'ستوري',
};

const platformLabels: Record<ContentItem['platform'], string> = {
  youtube: 'يوتيوب',
  tiktok: 'تيك توك',
  instagram: 'إنستغرام',
  facebook: 'فيسبوك',
  x: 'إكس',
  linkedin: 'لينكدإن',
  snapchat: 'سناب شات',
  telegram: 'تيليجرام',
  other: 'منصة أخرى',
};

export function safeTimezone(timezone: string | null | undefined): string {
  if (!timezone) return defaultTimezone;
  try {
    new Intl.DateTimeFormat('ar-EG', { timeZone: timezone });
    return timezone;
  } catch {
    return defaultTimezone;
  }
}

export function formatScheduledAt(isoDate: string, timezone: string): string {
  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: safeTimezone(timezone),
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoDate));
}

export function formatItem(item: ContentItem, timezone: string, index?: number): string {
  const prefix = index === undefined ? '•' : `${index + 1}.`;
  return [
    `${prefix} ${item.title.slice(0, 200)}`,
    `${contentTypeLabels[item.content_type]} · ${platformLabels[item.platform]}`,
    formatScheduledAt(item.scheduled_at, timezone),
  ].join('\n');
}

export function getTodayUtcRange(timezone: string, now = new Date()): {
  start: string;
  end: string;
} {
  const normalizedTimezone = safeTimezone(timezone);
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: normalizedTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
  const dateKey = `${values.year}-${values.month}-${values.day}`;

  const nextDate = new Date(`${dateKey}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const nextDateKey = nextDate.toISOString().slice(0, 10);

  return {
    start: fromZonedTime(`${dateKey}T00:00:00`, normalizedTimezone).toISOString(),
    end: fromZonedTime(`${nextDateKey}T00:00:00`, normalizedTimezone).toISOString(),
  };
}

export function helpMessage(isLinked: boolean): string {
  const linkHelp = isLinked
    ? 'حسابك مربوط حاليًا. استخدم /unlink لفك الربط.'
    : 'لربط حسابك: افتح الإعدادات في الموقع واضغط «ربط الآن»، ثم أرسل /start متبوعًا بالكود.';

  return [
    'أوامر منظّم النشر:',
    '/today — مواعيد اليوم',
    '/upcoming — أقرب 5 مواعيد',
    '/done — آخر المواعيد وتسجيل ما نُشر',
    '/unlink — فك ربط الحساب',
    '/help — عرض هذه المساعدة',
    '',
    linkHelp,
  ].join('\n');
}

export function startInstructions(): string {
  return 'لربط حسابك، افتح صفحة الإعدادات في منظّم النشر واضغط «ربط الآن»، ثم أرسل إلى هنا /start متبوعًا بكود الربط. صلاحية الكود 10 دقائق.';
}
