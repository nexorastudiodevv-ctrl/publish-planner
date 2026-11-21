import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ContentItem, ContentItemInput } from '../lib/types';

function databaseError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('network') || text.includes('fetch')) {
    return 'تعذر الاتصال بالشبكة. تحقق من اتصالك وحاول مجددًا.';
  }
  if (text.includes('row-level security')) {
    return 'ليس لديك صلاحية لتنفيذ هذا الإجراء.';
  }
  return 'تعذر حفظ التغييرات. حاول مجددًا.';
}

export function useContentItems(userId: string | undefined) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase || !userId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error: queryError } = await supabase
        .from('content_items')
        .select('*')
        .eq('user_id', userId)
        .order('scheduled_at', { ascending: true });

      if (queryError) {
        setError(databaseError(queryError.message));
      } else {
        setItems(data ?? []);
        setError(null);
      }
    } catch {
      setError('تعذر الاتصال بالشبكة. تحقق من اتصالك وحاول مجددًا.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
    if (!supabase || !userId) return;

    const channel = supabase
      .channel(`content-items-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_items',
          filter: `user_id=eq.${userId}`,
        },
        () => void refresh(),
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError('تعذر الاتصال بالتحديث الفوري. يمكنك إعادة تحميل القائمة يدويًا.');
        }
      });

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [refresh, userId]);

  const addItem = useCallback(
    async (input: ContentItemInput) => {
      if (!supabase || !userId) throw new Error('انتهت جلسة الدخول. سجّل الدخول مجددًا.');
      const { error: insertError } = await supabase
        .from('content_items')
        .insert({ ...input, user_id: userId });
      if (insertError) throw new Error(databaseError(insertError.message));
      await refresh();
    },
    [refresh, userId],
  );

  const updateItem = useCallback(
    async (id: string, input: ContentItemInput) => {
      if (!supabase || !userId) throw new Error('انتهت جلسة الدخول. سجّل الدخول مجددًا.');
      const { error: updateError } = await supabase
        .from('content_items')
        .update(input)
        .eq('id', id)
        .eq('user_id', userId);
      if (updateError) throw new Error(databaseError(updateError.message));
      await refresh();
    },
    [refresh, userId],
  );

  const markPublished = useCallback(
    async (id: string) => {
      if (!supabase || !userId) throw new Error('انتهت جلسة الدخول. سجّل الدخول مجددًا.');
      const { error: updateError } = await supabase
        .from('content_items')
        .update({ status: 'published' })
        .eq('id', id)
        .eq('user_id', userId);
      if (updateError) throw new Error(databaseError(updateError.message));
      await refresh();
    },
    [refresh, userId],
  );

  const deleteItem = useCallback(
    async (id: string) => {
      if (!supabase || !userId) throw new Error('انتهت جلسة الدخول. سجّل الدخول مجددًا.');
      const { error: deleteError } = await supabase
        .from('content_items')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (deleteError) throw new Error(databaseError(deleteError.message));
      await refresh();
    },
    [refresh, userId],
  );

  return { items, loading, error, refresh, addItem, updateItem, markPublished, deleteItem };
}
