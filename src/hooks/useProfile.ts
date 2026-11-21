import { useCallback, useEffect, useState } from 'react';
import type { Profile } from '../lib/types';
import { supabase } from '../lib/supabase';

function databaseError(message: string): string {
  if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch')) {
    return 'تعذر الاتصال بالشبكة. تحقق من اتصالك وحاول مجددًا.';
  }
  return 'تعذر تحميل إعدادات الحساب أو حفظها. حاول مجددًا.';
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase || !userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (queryError) {
        setError(databaseError(queryError.message));
      } else if (!data) {
        setError('لم يتم العثور على ملف الحساب. أعد تسجيل الدخول أو تواصل مع الدعم.');
      } else {
        setProfile(data);
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
      .channel(`profile-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => setProfile(payload.new as Profile),
      )
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [refresh, userId]);

  const updateTimezone = useCallback(
    async (timezone: string) => {
      if (!supabase || !userId) throw new Error('انتهت جلسة الدخول. سجّل الدخول مجددًا.');
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({ timezone })
        .eq('id', userId)
        .select('*')
        .single();

      if (updateError) throw new Error(databaseError(updateError.message));
      setProfile(data);
      setError(null);
    },
    [userId],
  );

  const updateNotificationChannel = useCallback(
    async (channel: 'push_enabled' | 'telegram_enabled', enabled: boolean) => {
      if (!supabase || !userId) throw new Error('انتهت جلسة الدخول. سجّل الدخول مجددًا.');
      const update =
        channel === 'push_enabled'
          ? { push_enabled: enabled }
          : { telegram_enabled: enabled };
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(update)
        .eq('id', userId)
        .select('*')
        .single();
      if (updateError) throw new Error(databaseError(updateError.message));
      setProfile(data);
    },
    [userId],
  );

  return { profile, loading, error, refresh, updateTimezone, updateNotificationChannel };
}
