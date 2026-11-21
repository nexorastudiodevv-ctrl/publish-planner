import { useMemo, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { FilterBar } from '../components/FilterBar';
import { ItemForm } from '../components/ItemForm';
import { ItemList, type ItemGroup } from '../components/ItemList';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';
import { useContentItems } from '../hooks/useContentItems';
import { useProfile } from '../hooks/useProfile';
import { getDayKey, isOverdue, safeTimezone } from '../lib/time';
import type { ContentItem, ContentType, Platform } from '../lib/types';

export function Dashboard() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const timezone = safeTimezone(profile?.timezone);
  const { items, loading, error, refresh, addItem, updateItem, markPublished, deleteItem } =
    useContentItems(user?.id);
  const [platformFilter, setPlatformFilter] = useState<Platform | ''>('');
  const [typeFilter, setTypeFilter] = useState<ContentType | ''>('');
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const filteredItems = useMemo(
    () => items.filter((item) =>
      (!platformFilter || item.platform === platformFilter) &&
      (!typeFilter || item.content_type === typeFilter)),
    [items, platformFilter, typeFilter],
  );

  const groups = useMemo<ItemGroup[]>(() => {
    const now = new Date();
    const todayKey = getDayKey(now, timezone);
    const scheduled = filteredItems.filter((item) => item.status === 'scheduled');
    const published = filteredItems.filter((item) => item.status === 'published');
    const overdueItems = scheduled.filter((item) => isOverdue(item.scheduled_at, now, timezone));
    const todayItems = scheduled.filter(
      (item) => !isOverdue(item.scheduled_at, now, timezone) &&
        getDayKey(new Date(item.scheduled_at), timezone) === todayKey,
    );
    const upcoming = scheduled.filter(
      (item) => !isOverdue(item.scheduled_at, now, timezone) &&
        getDayKey(new Date(item.scheduled_at), timezone) !== todayKey,
    );
    return [
      { id: 'today', title: 'اليوم', description: 'مواعيدك لهذا اليوم', items: todayItems },
      { id: 'upcoming', title: 'القادم', description: 'استعد لما هو آتٍ', items: upcoming },
      { id: 'overdue', title: 'متأخر', description: 'مواعيد لم تُنشر بعد', items: overdueItems },
      { id: 'published', title: 'تم نشرها', description: 'إنجازاتك الأخيرة', items: published },
    ];
  }, [filteredItems, timezone]);

  async function createItem(input: Parameters<typeof addItem>[0]) {
    await addItem(input);
    setToast({ message: 'أُضيف الموعد إلى خطتك.', type: 'success' });
  }

  async function editItem(input: Parameters<typeof updateItem>[1]) {
    if (!editingItem) return;
    await updateItem(editingItem.id, input);
    setEditingItem(null);
    setToast({ message: 'تم تحديث الموعد بنجاح.', type: 'success' });
  }

  async function publishItem(id: string) {
    try {
      await markPublished(id);
      setToast({ message: 'أحسنت! تم تسجيل المحتوى كمنشور.', type: 'success' });
    } catch (actionError) {
      setToast({
        message: actionError instanceof Error ? actionError.message : 'تعذر تحديث الموعد.',
        type: 'error',
      });
    }
  }

  async function removeItem(id: string) {
    try {
      await deleteItem(id);
      setToast({ message: 'تم حذف الموعد.', type: 'success' });
    } catch (actionError) {
      setToast({
        message: actionError instanceof Error ? actionError.message : 'تعذر حذف الموعد.',
        type: 'error',
      });
    }
  }

  return (
    <AppLayout>
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">مساحتك الإبداعية</p>
          <h1>صباح الإبداع{user?.email ? '،' : ''}<span className="hero-dot">.</span></h1>
          <p>رتّب أفكارك اليوم، لتصل لجمهورك في الوقت المناسب.</p>
        </div>
        <div className="hero-date">
          <span className="hero-date-mark" aria-hidden="true">✳</span>
          <span>منطقتك الزمنية</span>
          <strong dir="ltr">{timezone.replace(/_/g, ' ')}</strong>
        </div>
      </section>

      <section className="dashboard-stats" aria-label="ملخص المواعيد">
        <div className="stat-card stat-today">
          <span className="stat-label">مواعيد اليوم</span>
          <strong>{groups.find((group) => group.id === 'today')?.items.length ?? 0}</strong>
          <span className="stat-icon" aria-hidden="true">◷</span>
        </div>
        <div className="stat-card stat-upcoming">
          <span className="stat-label">في انتظارك</span>
          <strong>{groups.find((group) => group.id === 'upcoming')?.items.length ?? 0}</strong>
          <span className="stat-icon" aria-hidden="true">↗</span>
        </div>
        <div className="stat-card stat-published">
          <span className="stat-label">تم نشرها</span>
          <strong>{groups.find((group) => group.id === 'published')?.items.length ?? 0}</strong>
          <span className="stat-icon" aria-hidden="true">✓</span>
        </div>
      </section>

      <section className="panel create-panel" aria-labelledby="create-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">فكرة جديدة؟</p>
            <h2 id="create-heading">أضف موعد نشر</h2>
          </div>
          <span className="section-number">01</span>
        </div>
        <ItemForm timezone={timezone} onSubmit={createItem} />
      </section>

      <section className="schedule-section" aria-labelledby="schedule-heading">
        <div className="schedule-heading">
          <div>
            <p className="eyebrow">نظرة على خطتك</p>
            <h2 id="schedule-heading">مواعيدك</h2>
          </div>
          <button className="button button-quiet button-small" type="button" onClick={() => void refresh()}>
            تحديث القائمة
          </button>
        </div>
        <FilterBar
          platform={platformFilter}
          contentType={typeFilter}
          onPlatformChange={setPlatformFilter}
          onContentTypeChange={setTypeFilter}
          onClear={() => { setPlatformFilter(''); setTypeFilter(''); }}
        />
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button className="button button-small button-quiet" type="button" onClick={() => void refresh()}>
              إعادة المحاولة
            </button>
          </div>
        )}
        {loading ? (
          <div className="loading-panel" role="status">
            <span className="spinner" aria-hidden="true" />
            <p>جارٍ تحميل مواعيدك…</p>
          </div>
        ) : (
          <ItemList
            groups={groups}
            timezone={timezone}
            onEdit={setEditingItem}
            onPublish={publishItem}
            onDelete={removeItem}
            emptyState={items.length === 0
              ? 'لا توجد مواعيد بعد. أضف أول موعد نشر من النموذج أعلاه.'
              : 'لا توجد مواعيد تطابق هذه الفلاتر.'}
          />
        )}
      </section>

      {editingItem && (
        <Modal title="تعديل موعد النشر" onClose={() => setEditingItem(null)}>
          <ItemForm
            key={editingItem.id}
            timezone={timezone}
            initialItem={editingItem}
            onSubmit={editItem}
            onCancel={() => setEditingItem(null)}
            submitLabel="حفظ التعديلات"
          />
        </Modal>
      )}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </AppLayout>
  );
}
