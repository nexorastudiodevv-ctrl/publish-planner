import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { Toast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../lib/supabase';
import { DEFAULT_TIMEZONE, formatScheduledAt, safeTimezone } from '../lib/time';
import {
  isIosDevice,
  isStandalone,
  type PushSetupStatus,
  urlBase64ToUint8Array,
} from '../lib/push';

const timezoneOptions = [
  { value: 'Africa/Cairo', label: 'القاهرة — مصر' },
  { value: 'Asia/Riyadh', label: 'الرياض — السعودية' },
  { value: 'Asia/Dubai', label: 'دبي — الإمارات' },
  { value: 'Asia/Amman', label: 'عمّان — الأردن' },
  { value: 'Asia/Kuwait', label: 'الكويت' },
  { value: 'Asia/Beirut', label: 'بيروت — لبنان' },
  { value: 'Africa/Casablanca', label: 'الدار البيضاء — المغرب' },
  { value: 'Africa/Tunis', label: 'تونس' },
  { value: 'Europe/London', label: 'لندن — المملكة المتحدة' },
  { value: 'Europe/Paris', label: 'باريس — فرنسا' },
  { value: 'Europe/Berlin', label: 'برلين — ألمانيا' },
  { value: 'America/New_York', label: 'نيويورك — الولايات المتحدة' },
  { value: 'America/Los_Angeles', label: 'لوس أنجلوس — الولايات المتحدة' },
  { value: 'UTC', label: 'التوقيت العالمي UTC' },
];

const telegramBotUsername = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? '')
  .trim()
  .replace(/^@/, '');
const telegramBotUrlPattern = /^[A-Za-z0-9_]{5,32}$/;

type LinkCode = { code: string; expires_at: string };

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function Settings() {
  const { user } = useAuth();
  const { profile, loading, error: profileError, updateTimezone, updateNotificationChannel } = useProfile(user?.id);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [savingTimezone, setSavingTimezone] = useState(false);
  const [creatingCode, setCreatingCode] = useState(false);
  const [code, setCode] = useState<LinkCode | null>(null);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [pushStatus, setPushStatus] = useState<PushSetupStatus>('loading');
  const [pushBusy, setPushBusy] = useState(false);
  const [testingPush, setTestingPush] = useState(false);

  useEffect(() => {
    if (profile?.timezone) setTimezone(profile.timezone);
  }, [profile?.timezone]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
  }, []);

  useEffect(() => {
    async function refreshPushStatus() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setPushStatus('unsupported');
        return;
      }
      if (isIosDevice() && !isStandalone()) {
        setPushStatus('ios-install-required');
        return;
      }
      if (Notification.permission === 'denied') {
        setPushStatus('permission-denied');
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setPushStatus(subscription && profile?.push_enabled ? 'enabled' : 'disabled');
      } catch {
        setPushStatus('unsupported');
      }
    }
    if (profile) void refreshPushStatus();
  }, [profile?.push_enabled]);

  const availableTimezones = useMemo(() => {
    if (timezoneOptions.some((option) => option.value === timezone)) return timezoneOptions;
    return [{ value: timezone, label: `${timezone} — المنطقة الحالية` }, ...timezoneOptions];
  }, [timezone]);

  const codeRemaining = code ? new Date(code.expires_at).getTime() - now : 0;
  const codeActive = codeRemaining > 0;
  const remainingLabel = codeActive
    ? `${Math.floor(codeRemaining / 60000)}:${String(Math.floor((codeRemaining % 60000) / 1000)).padStart(2, '0')}`
    : null;

  async function saveTimezone() {
    setSavingTimezone(true);
    try {
      await updateTimezone(timezone);
      setToast({ message: 'تم حفظ المنطقة الزمنية.', type: 'success' });
    } catch (saveError) {
      setToast({
        message: saveError instanceof Error ? saveError.message : 'تعذر حفظ المنطقة الزمنية.',
        type: 'error',
      });
    } finally {
      setSavingTimezone(false);
    }
  }

  async function createLinkCode() {
    if (!supabase || !user) {
      setToast({ message: 'انتهت جلسة الدخول. سجّل الدخول مجددًا.', type: 'error' });
      return;
    }
    setCreatingCode(true);
    try {
      const { data, error: insertError } = await supabase
        .from('telegram_link_codes')
        .insert({ user_id: user.id })
        .select('code, expires_at')
        .single();
      if (insertError) throw new Error('تعذر إنشاء كود الربط. حاول مجددًا.');
      setCode(data);
    } catch (linkError) {
      setToast({
        message: linkError instanceof Error ? linkError.message : 'تعذر إنشاء كود الربط.',
        type: 'error',
      });
    } finally {
      setCreatingCode(false);
    }
  }

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  async function enablePush() {
    if (!supabase || !user) return;
    const publicKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '').trim();
    if (!publicKey) {
      setToast({ message: 'لم يُضبط مفتاح VAPID العام بعد.', type: 'error' });
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setPushStatus('unsupported');
      return;
    }
    if (isIosDevice() && !isStandalone()) {
      setPushStatus('ios-install-required');
      return;
    }

    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatus('permission-denied');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      const json = subscription.toJSON();
      if (!json.keys?.p256dh || !json.keys.auth) throw new Error('تعذر قراءة مفاتيح الاشتراك.');

      const { error: upsertError } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: navigator.userAgent,
          failure_count: 0,
        }, { onConflict: 'endpoint' });
      if (upsertError) throw new Error('تعذر حفظ اشتراك التنبيهات.');
      await updateNotificationChannel('push_enabled', true);
      setPushStatus('enabled');
      setToast({ message: 'تم تفعيل تنبيهات التطبيق.', type: 'success' });
    } catch (pushError) {
      setToast({
        message: pushError instanceof Error ? pushError.message : 'تعذر تفعيل تنبيهات التطبيق.',
        type: 'error',
      });
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    if (!supabase || !user) return;
    setPushBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', subscription.endpoint);
        await subscription.unsubscribe();
      }
      await updateNotificationChannel('push_enabled', false);
      setPushStatus('disabled');
      setToast({ message: 'تم إيقاف تنبيهات التطبيق.', type: 'success' });
    } catch {
      setToast({ message: 'تعذر إيقاف تنبيهات التطبيق.', type: 'error' });
    } finally {
      setPushBusy(false);
    }
  }

  async function toggleTelegram(enabled: boolean) {
    try {
      await updateNotificationChannel('telegram_enabled', enabled);
      setToast({ message: enabled ? 'تم تفعيل تنبيهات تيليجرام.' : 'تم إيقاف تنبيهات تيليجرام.', type: 'success' });
    } catch (toggleError) {
      setToast({
        message: toggleError instanceof Error ? toggleError.message : 'تعذر تغيير إعداد تيليجرام.',
        type: 'error',
      });
    }
  }

  async function testPush() {
    if (!supabase) return;
    setTestingPush(true);
    try {
      const { error: functionError } = await supabase.functions.invoke('test-push', { body: {} });
      if (functionError) throw new Error('تعذر إرسال التنبيه التجريبي.');
      setToast({ message: 'تم إرسال التنبيه التجريبي، افحص الإشعارات خلال ثوانٍ.', type: 'success' });
    } catch (testError) {
      setToast({
        message: testError instanceof Error ? testError.message : 'تعذر إرسال التنبيه التجريبي.',
        type: 'error',
      });
    } finally {
      setTestingPush(false);
    }
  }

  return (
    <AppLayout>
      <section className="settings-hero">
        <p className="eyebrow">مساحتك، بطريقتك</p>
        <h1>الإعدادات<span className="hero-dot">.</span></h1>
        <p>اضبط تفاصيل حسابك وطريقة عرض مواعيدك.</p>
      </section>

      {profileError && <div className="error-banner" role="alert">{profileError}</div>}

      <section className="panel settings-panel" aria-labelledby="timezone-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">الوقت المناسب لك</p>
            <h2 id="timezone-heading">المنطقة الزمنية</h2>
            <p className="section-description">تُستخدم لعرض مواعيدك وإنشاء تنبيهات في توقيتك المحلي.</p>
          </div>
          <span className="section-number">01</span>
        </div>
        {loading ? (
          <div className="loading-inline"><span className="spinner" aria-hidden="true" /> جارٍ تحميل الإعدادات…</div>
        ) : (
          <div className="timezone-controls">
            <label className="field timezone-field" htmlFor="timezone-select">
              <span>اختر منطقتك الزمنية</span>
              <select
                id="timezone-select"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
              >
                {availableTimezones.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <button
              className="button button-primary"
              type="button"
              onClick={() => void saveTimezone()}
              disabled={savingTimezone || !profile || timezone === profile.timezone}
            >
              {savingTimezone ? 'جارٍ الحفظ…' : 'حفظ المنطقة'}
            </button>
          </div>
        )}
        <p className="timezone-preview">
          الوقت الآن: <strong>{formatScheduledAt(new Date().toISOString(), safeTimezone(timezone))}</strong>
        </p>
      </section>

      <section className="panel telegram-panel" aria-labelledby="telegram-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">تنبيهك، أينما كنت</p>
            <h2 id="telegram-heading">ربط تيليجرام</h2>
            <p className="section-description">
              اعرض مواعيدك وأدرها من البوت. تنبيهات المواعيد التلقائية ستُضاف في مرحلة لاحقة.
            </p>
          </div>
          <span className="section-number">02</span>
        </div>
        <div className="telegram-status">
          <span className={`connection-indicator${profile?.telegram_chat_id ? ' connected' : ''}`} aria-hidden="true" />
          <span>{profile?.telegram_chat_id ? 'حسابك مربوط بتيليجرام' : 'لم يتم ربط تيليجرام بعد'}</span>
          <span className={`status-pill${profile?.telegram_chat_id ? ' status-published' : ''}`}>
            {profile?.telegram_chat_id ? 'مربوط' : 'غير مربوط'}
          </span>
        </div>
        {profile?.telegram_chat_id ? (
          <p className="linked-account">
            تم ربط حساب تيليجرام بنجاح. يمكنك الآن استخدام أوامر البوت لإدارة مواعيدك.
          </p>
        ) : (
          <>
            <button
              className="button button-telegram"
              type="button"
              onClick={() => void createLinkCode()}
              disabled={loading || !profile || creatingCode || codeActive}
            >
              {creatingCode && <span className="button-spinner" aria-hidden="true" />}
              {creatingCode ? 'جارٍ تجهيز كودك…' : codeActive ? 'الكود صالح للاستخدام' : code ? 'إنشاء كود جديد' : 'ربط الآن'}
            </button>
            {code && codeActive && (
              <div className="link-code-box" aria-live="polite">
                <p>افتح البوت وأرسل:</p>
                <code dir="ltr">/start {code.code}</code>
                <span>تنتهي صلاحية الكود خلال {remainingLabel}</span>
                {telegramBotUrlPattern.test(telegramBotUsername) && (
                  <>
                    <a
                      className="telegram-deep-link"
                      href={`https://t.me/${telegramBotUsername}?start=${encodeURIComponent(code.code)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      فتح البوت وإرسال الكود ↗
                    </a>
                    <span>إذا كانت هذه أول مرة، اضغط «Start» داخل تيليجرام لإرسال الكود.</span>
                  </>
                )}
              </div>
            )}
            {code && !codeActive && (
              <p className="inline-notice" role="status">انتهت صلاحية الكود. أنشئ كودًا جديدًا للمتابعة.</p>
            )}
            <p className="future-note">
              ربط الحساب وأوامر البوت متاحة الآن. إرسال تنبيهات المواعيد المجدولة سيُضاف في المرحلة التالية.
            </p>
          </>
        )}
      </section>

      <section className="panel settings-panel" aria-labelledby="notifications-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">قنوات التنبيه</p>
            <h2 id="notifications-heading">التنبيهات</h2>
            <p className="section-description">اختر ما يصل إليك من التطبيق ومن تيليجرام.</p>
          </div>
          <span className="section-number">03</span>
        </div>

        {installPrompt && (
          <div className="timezone-controls">
            <p>يمكن تثبيت منظّم النشر كتطبيق مستقل.</p>
            <button className="button button-primary" type="button" onClick={() => void installApp()}>
              تثبيت التطبيق
            </button>
          </div>
        )}

        {isIosDevice() && !isStandalone() && (
          <p className="inline-notice" role="status">
            على iPhone أو iPad: اضغط مشاركة ← إضافة إلى الشاشة الرئيسية، ثم افتح التطبيق المثبّت لتفعيل Web Push على iOS 16.4 وما أحدث.
          </p>
        )}

        <div className="timezone-controls">
          <div>
            <strong>تنبيهات التطبيق (Push)</strong>
            <p>
              {pushStatus === 'unsupported' && 'المتصفح غير داعم Web Push.'}
              {pushStatus === 'permission-denied' && 'الإذن مرفوض. افتح إعدادات إشعارات الموقع في المتصفح، اسمح بالإشعارات، ثم أعد المحاولة.'}
              {pushStatus === 'ios-install-required' && 'ثبّت التطبيق على الشاشة الرئيسية قبل تفعيل التنبيهات.'}
              {pushStatus === 'loading' && 'جارٍ التحقق من حالة الاشتراك…'}
              {pushStatus === 'enabled' && 'مفعّل — سيصل تنبيه جديد حتى إذا كان المتصفح مغلقًا على المنصة الداعمة.'}
              {pushStatus === 'disabled' && 'غير مفعّل.'}
            </p>
          </div>
          {pushStatus === 'enabled' ? (
            <button className="button" type="button" onClick={() => void disablePush()} disabled={pushBusy}>
              {pushBusy ? 'لحظة…' : 'إيقاف تنبيهات التطبيق'}
            </button>
          ) : (
            <button
              className="button button-primary"
              type="button"
              onClick={() => void enablePush()}
              disabled={pushBusy || pushStatus === 'unsupported' || pushStatus === 'ios-install-required'}
            >
              {pushBusy ? 'جارٍ التفعيل…' : 'تفعيل تنبيهات التطبيق'}
            </button>
          )}
        </div>

        <div className="timezone-controls">
          <div>
            <strong>تنبيهات تيليجرام</strong>
            <p>{profile?.telegram_enabled ? 'مفعّل' : 'غير مفعّل'}.</p>
          </div>
          <button
            className="button"
            type="button"
            disabled={!profile || loading}
            onClick={() => void toggleTelegram(!profile?.telegram_enabled)}
          >
            {profile?.telegram_enabled ? 'إيقاف تيليجرام' : 'تفعيل تيليجرام'}
          </button>
        </div>

        <button
          className="button button-primary"
          type="button"
          onClick={() => void testPush()}
          disabled={testingPush || pushStatus !== 'enabled'}
        >
          {testingPush ? 'جارٍ الإرسال…' : 'إرسال تنبيه تجريبي'}
        </button>
      </section>

      <section className="panel account-panel" aria-labelledby="account-heading">
        <div>
          <p className="eyebrow">بيانات الدخول</p>
          <h2 id="account-heading">حسابك</h2>
          <p className="account-email" dir="ltr">{user?.email}</p>
        </div>
        <p className="account-footnote">لحماية حسابك، لا تشارك رابطًا أو كودًا غير موثوق.</p>
      </section>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </AppLayout>
  );
}
