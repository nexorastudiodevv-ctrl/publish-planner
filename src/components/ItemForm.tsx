import { useId, useMemo, useState, type FormEvent } from 'react';
import { contentTypes, platforms, contentTypeLabels, platformLabels } from '../lib/labels';
import { fromTimezoneInput, getLocalDateTimeInput } from '../lib/time';
import type { ContentItem, ContentItemInput, ContentType, Platform } from '../lib/types';

type ItemFormProps = {
  timezone: string;
  initialItem?: ContentItem;
  onSubmit: (input: ContentItemInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
};

const reminders = [
  { value: 0, label: 'في الموعد' },
  { value: 10, label: 'قبل 10 دقائق' },
  { value: 30, label: 'قبل 30 دقيقة' },
  { value: 60, label: 'قبل 60 دقيقة' },
];

export function ItemForm({
  timezone,
  initialItem,
  onSubmit,
  onCancel,
  submitLabel = 'إضافة إلى الخطة',
}: ItemFormProps) {
  const fieldId = useId().replace(/:/g, '');
  const initialDateTime = useMemo(
    () => initialItem
      ? getLocalDateTimeInput(initialItem.scheduled_at, timezone)
      : getLocalDateTimeInput(new Date(), timezone),
    [initialItem, timezone],
  );
  const [title, setTitle] = useState(initialItem?.title ?? '');
  const [contentType, setContentType] = useState<ContentType>(initialItem?.content_type ?? 'post');
  const [platform, setPlatform] = useState<Platform>(initialItem?.platform ?? 'instagram');
  const [date, setDate] = useState(initialDateTime.date);
  const [time, setTime] = useState(initialDateTime.time);
  const [reminder, setReminder] = useState(String(initialItem?.remind_before_minutes ?? 0));
  const [note, setNote] = useState(initialItem?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scheduledAt = useMemo(() => {
    if (!date || !time) return null;
    try {
      return fromTimezoneInput(date, time, timezone);
    } catch {
      return null;
    }
  }, [date, time, timezone]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('أدخل عنوان المحتوى.');
      return;
    }
    if (!date || !time || !scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      setError('اختر تاريخًا ووقتًا صالحين للنشر.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        content_type: contentType,
        platform,
        scheduled_at: scheduledAt.toISOString(),
        remind_before_minutes: Number(reminder),
        note: note.trim() || null,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'تعذر حفظ الموعد.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="item-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
      <div className="form-grid">
        <div className="field field-wide">
          <label htmlFor={`${fieldId}-title`}>عنوان المحتوى <span className="required">*</span></label>
          <input
            id={`${fieldId}-title`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="مثال: فيديو إطلاق المنتج"
            maxLength={180}
            required
          />
        </div>
        <div className="field">
          <label htmlFor={`${fieldId}-type`}>نوع المحتوى</label>
          <select
            id={`${fieldId}-type`}
            value={contentType}
            onChange={(event) => setContentType(event.target.value as ContentType)}
          >
            {contentTypes.map((type) => <option key={type} value={type}>{contentTypeLabels[type]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${fieldId}-platform`}>المنصة</label>
          <select
            id={`${fieldId}-platform`}
            value={platform}
            onChange={(event) => setPlatform(event.target.value as Platform)}
          >
            {platforms.map((itemPlatform) => (
              <option key={itemPlatform} value={itemPlatform}>{platformLabels[itemPlatform]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${fieldId}-date`}>التاريخ <span className="required">*</span></label>
          <input
            id={`${fieldId}-date`}
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor={`${fieldId}-time`}>الساعة <span className="required">*</span></label>
          <input
            id={`${fieldId}-time`}
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            required
          />
        </div>
        <div className="field field-wide">
          <label htmlFor={`${fieldId}-reminder`}>نبّهني قبل</label>
          <select
            id={`${fieldId}-reminder`}
            value={reminder}
            onChange={(event) => setReminder(event.target.value)}
          >
            {reminders.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div className="field field-wide">
          <label htmlFor={`${fieldId}-note`}>ملاحظات <span className="muted-inline">اختياري</span></label>
          <textarea
            id={`${fieldId}-note`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="أضف رابطًا أو فكرة أو ملاحظة تساعدك لاحقًا"
          />
        </div>
      </div>
      {scheduledAt && scheduledAt.getTime() < Date.now() && (
        <p className="inline-notice" role="status">هذا الموعد في الماضي؛ يمكنك حفظه كموعد متأخر.</p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        {onCancel && (
          <button className="button button-quiet" type="button" onClick={onCancel} disabled={saving}>
            إلغاء
          </button>
        )}
        <button className="button button-primary" type="submit" disabled={saving}>
          {saving && <span className="button-spinner" aria-hidden="true" />}
          {saving ? 'جارٍ الحفظ…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
