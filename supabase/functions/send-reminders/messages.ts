import type { ContentItem, ReminderClaim, TelegramInlineKeyboard } from '../_shared/types.ts';

const contentTypeLabels: Record<ContentItem['content_type'], string> = {
  video: 'فيديو',
  reel: 'ريلز',
  post: 'منشور',
  story: 'ستوري',
};

const platformLabels: Record<ContentItem['platform'], string> = {
  youtube: 'يوتيوب',
  tiktok: 'تيك توك',
  instagram: 'إنستجرام',
  facebook: 'فيسبوك',
  x: 'إكس',
  linkedin: 'لينكدإن',
  snapchat: 'سناب شات',
  telegram: 'تيليجرام',
  other: 'منصة أخرى',
};

function formatTime(isoDate: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(isoDate));
  } catch {
    return new Intl.DateTimeFormat('ar-EG', {
      timeZone: 'Africa/Cairo',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(isoDate));
  }
}

export function reminderMessage(claim: ReminderClaim): string {
  const contentType = contentTypeLabels[claim.content_type];
  const platform = platformLabels[claim.platform];
  const title = claim.title.trim().slice(0, 180);
  const lead = claim.reminder_kind === 'pre'
    ? `⏰ بعد ${claim.remind_before_minutes} دقيقة: نشر ${contentType} على ${platform} — «${title}» (${formatTime(claim.scheduled_at, claim.timezone)})`
    : `🚀 حان الآن موعد نشر ${contentType} على ${platform} — «${title}» (${formatTime(claim.scheduled_at, claim.timezone)})`;
  const note = claim.note?.trim();
  return note ? `${lead}\n\nملاحظة: ${note.slice(0, 1500)}` : lead;
}

export function reminderKeyboard(itemId: string): TelegramInlineKeyboard {
  return {
    inline_keyboard: [[
      { text: 'تم النشر ✅', callback_data: `done:${itemId}` },
      { text: 'تأجيل 15 دقيقة ⏳', callback_data: `snooze15:${itemId}` },
      { text: 'إلغاء ❌', callback_data: `cancel:${itemId}` },
    ]],
  };
}
