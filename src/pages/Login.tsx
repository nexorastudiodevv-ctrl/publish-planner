import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

type LocationState = { from?: { pathname?: string } };

export function Login() {
  const { user, loading, configured, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from?.pathname ?? '/';
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (loading) {
    return <main className="screen-center"><span className="spinner" aria-hidden="true" /><p>جارٍ التحضير…</p></main>;
  }
  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setError('أدخل البريد الإلكتروني وكلمة المرور.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
        navigate(from, { replace: true });
      } else {
        const needsConfirmation = await signUp(email.trim(), password);
        if (needsConfirmation) {
          setNotice('تم إنشاء الحساب. تحقق من بريدك الإلكتروني لتأكيده، ثم سجّل الدخول.');
          setMode('login');
          setPassword('');
        } else {
          navigate('/', { replace: true });
        }
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'تعذر إكمال العملية.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <span className="brand-mark brand-mark-large" aria-hidden="true">م</span>
          <p className="eyebrow">مساحة أهدأ لصناعة المحتوى</p>
          <h1>كل موعد نشر،<br /><span>في مكانه.</span></h1>
          <p className="login-intro">خطّط لمحتواك، تابع مواعيدك، واترك الباقي على منظّم النشر.</p>
        </div>
        <div className="login-form-wrap">
          <div className="auth-tabs" role="tablist" aria-label="نوع الحساب">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'auth-tab selected' : 'auth-tab'}
              onClick={() => { setMode('login'); setError(null); setNotice(null); }}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={mode === 'signup' ? 'auth-tab selected' : 'auth-tab'}
              onClick={() => { setMode('signup'); setError(null); setNotice(null); }}
            >
              حساب جديد
            </button>
          </div>
          {!configured && (
            <p className="form-error" role="alert">
              أضف `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` إلى ملف `.env` ثم أعد تشغيل التطبيق.
            </p>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="inline-notice" role="status">{notice}</p>}
          <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
            <div className="field">
              <label htmlFor="login-email">البريد الإلكتروني</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                dir="ltr"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="login-password">كلمة المرور</label>
              <input
                id="login-password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
            </div>
            <button className="button button-primary button-full" type="submit" disabled={busy || !configured}>
              {busy && <span className="button-spinner" aria-hidden="true" />}
              {busy ? 'لحظة من فضلك…' : mode === 'login' ? 'دخول إلى حسابي' : 'إنشاء حساب'}
            </button>
          </form>
          <p className="auth-footnote">بتسجيل الدخول، تصبح خطتك ومواعيدك محفوظة في حسابك.</p>
        </div>
      </section>
      <footer className="login-footer">منظّم النشر · خطوتك التالية تبدأ بموعد</footer>
    </main>
  );
}
