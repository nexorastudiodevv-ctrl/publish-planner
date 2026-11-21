import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { storePushAuth } from '../lib/push';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function translateAuthError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  if (text.includes('user already registered')) return 'هذا البريد مسجّل بالفعل. جرّب تسجيل الدخول.';
  if (text.includes('password should be at least')) return 'كلمة المرور قصيرة جدًا.';
  if (text.includes('email not confirmed')) return 'يرجى تأكيد بريدك الإلكتروني قبل تسجيل الدخول.';
  if (text.includes('rate limit')) return 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.';
  if (text.includes('network') || text.includes('fetch')) return 'تعذر الاتصال. تحقق من الإنترنت وحاول مجددًا.';
  return 'تعذر إكمال العملية. تحقق من البيانات وحاول مجددًا.';
}

function requireClient() {
  if (!supabase) {
    throw new Error('إعدادات Supabase غير مكتملة. أضف VITE_SUPABASE_URL وVITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user ?? null);
      const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() ?? '';
      void storePushAuth(session?.access_token ?? null, url, anonKey, vapidKey, session?.user.id).catch(() => undefined);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setUser(error ? null : data.session?.user ?? null);
      const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() ?? '';
      void storePushAuth(
        error ? null : data.session?.access_token ?? null,
        url,
        anonKey,
        vapidKey,
        data.session?.user.id,
      ).catch(() => undefined);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = requireClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(translateAuthError(error.message));
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const client = requireClient();
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw new Error(translateAuthError(error.message));
    return !data.session;
  }, []);

  const signOut = useCallback(async () => {
    const client = requireClient();
    const { error } = await client.auth.signOut();
    if (error) throw new Error(translateAuthError(error.message));
    await storePushAuth(
      null,
      import.meta.env.VITE_SUPABASE_URL?.trim() ?? '',
      import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '',
      import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() ?? '',
    ).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ user, loading, configured: isSupabaseConfigured, signIn, signUp, signOut }),
    [user, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth يجب أن يعمل داخل AuthProvider.');
  return context;
}
