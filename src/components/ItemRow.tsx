import { useState } from 'react';
import { contentTypeLabels, platformLabels, statusLabels } from '../lib/labels';
import { formatScheduledAt, isOverdue } from '../lib/time';
import type { ContentItem } from '../lib/types';

type ItemRowProps = {
  item: ContentItem;
  timezone: string;
  onEdit: (item: ContentItem) => void;
  onPublish: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function ItemRow({ item, timezone, onEdit, onPublish, onDelete }: ItemRowProps) {
  const [busy, setBusy] = useState(false);
  const isPublished = item.status === 'published';
  const overdue = item.status === 'scheduled' && isOverdue(item.scheduled_at, new Date(), timezone);

  async function publish() {
    setBusy(true);
    try {
      await onPublish(item.id);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const confirmed = window.confirm(`هل تريد حذف «${item.title}»؟ لا يمكن التراجع عن هذا الإجراء.`);
    if (!confirmed) return;
    setBusy(true);
    try {
      await onDelete(item.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`item-card${overdue ? ' item-overdue' : ''}`}>
      <div className="item-card-main">
        <div className="item-card-heading">
          <span className={`type-dot type-${item.content_type}`} aria-hidden="true" />
          <h3>{item.title}</h3>
          {isPublished && <span className="status-pill status-published">{statusLabels.published}</span>}
          {item.status === 'cancelled' && <span className="status-pill">{statusLabels.cancelled}</span>}
          {overdue && <span className="status-pill status-overdue">متأخر</span>}
        </div>
        <p className="item-meta">
          <span>{contentTypeLabels[item.content_type]}</span>
          <span className="meta-separator" aria-hidden="true">·</span>
          <span>{platformLabels[item.platform]}</span>
        </p>
        <p className="item-date">
          <span aria-hidden="true">◷</span>
          <time dateTime={item.scheduled_at}>{formatScheduledAt(item.scheduled_at, timezone)}</time>
        </p>
        {item.note && <p className="item-note">{item.note}</p>}
      </div>
      <div className="item-actions">
        {!isPublished && item.status !== 'cancelled' && (
          <button
            className="button button-success button-small"
            type="button"
            onClick={() => void publish()}
            disabled={busy}
          >
            تم النشر
          </button>
        )}
        <button
          className="button button-quiet button-small"
          type="button"
          onClick={() => onEdit(item)}
          disabled={busy}
          aria-label={`تعديل ${item.title}`}
        >
          تعديل
        </button>
        <button
          className="button button-danger-quiet button-small"
          type="button"
          onClick={() => void remove()}
          disabled={busy}
          aria-label={`حذف ${item.title}`}
        >
          حذف
        </button>
      </div>
    </article>
  );
}
