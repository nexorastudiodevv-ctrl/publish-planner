# منظّم النشر

تطبيق عربي لإدارة مواعيد نشر المحتوى على المنصات الاجتماعية، مع تسجيل دخول Supabase وتنبيهات تيليجرام.

## المتطلبات

- Node.js 20 أو أحدث وnpm.
- مشروع Supabase مع ترحيل قاعدة البيانات المجهز في `supabase/migrations/0001_init.sql`.
- يتضمن المشروع Edge Functions لربط البوت، وأوامره، وإرسال التذكيرات المجدولة. لا يتضمن PWA أو Web Push.

## تجهيز Supabase

1. أنشئ مشروعًا من [لوحة Supabase](https://supabase.com/dashboard)، ثم افتح **Project Settings → API** لنسخ عنوان المشروع ومفتاح `anon`.
2. طبّق ترحيل `supabase/migrations/0001_init.sql` من **SQL Editor**، أو اربط Supabase CLI وشغّل `supabase db push` من جذر المشروع.
3. من **Authentication → Sign In / Providers → Email** فعّل تسجيل الدخول بالبريد الإلكتروني، واضبط **URL Configuration** للسماح بـ `http://localhost:5173` أثناء التطوير وعناوين النشر لاحقًا.
4. فعّل Supabase Realtime لجدول `public.content_items` حتى تعمل مزامنة المواعيد الفورية.

## الإعداد والتشغيل المحلي

1. ثبّت الحزم:

   ```bash
   npm install
   ```

2. انسخ `.env.example` إلى `.env` وأدخل عنوان Supabase ومفتاح `anon` واسم البوت (من دون `@`):

   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   VITE_TELEGRAM_BOT_USERNAME=your_bot_username
   ```

   `VITE_TELEGRAM_BOT_USERNAME` اسم عام لعرض رابط البوت. لا تضف مفتاح `service_role` أو توكن البوت أو أي سر إلى متغيرات `VITE_` أو إلى الواجهة الأمامية.

3. شغّل بيئة التطوير:

   ```bash
   npm run dev
   ```

4. افتح العنوان المحلي الذي يعرضه Vite (عادةً `http://localhost:5173`). للتحقق من الأنواع وإنشاء نسخة إنتاج:

   ```bash
   npm run typecheck
   npm run build
   ```

## النشر على Vercel

1. اربط المستودع بمشروع جديد في Vercel.
2. اختر Vite كإطار العمل، واجعل أمر البناء `npm run build` ومجلد المخرجات `dist`.
3. أضف `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` و`VITE_TELEGRAM_BOT_USERNAME` في إعدادات Environment Variables لكل بيئة مطلوبة، ثم أعد النشر.
4. في Supabase، أضف عنوان الموقع المنشور إلى **Authentication → URL Configuration** ضمن Site URL وRedirect URLs.

## النشر على GitHub Pages

ينشر GitHub Actions نسخة البناء تلقائيًا عند الدفع إلى فرع `main`. استخدم إعداد Pages من نوع **GitHub Actions**؛ لا تختر النشر المباشر من جذر الفرع، لأن التطبيق يحتاج إلى بناء Vite.

1. من **Settings → Pages** اختر **GitHub Actions** كمصدر البناء والنشر.
2. من **Settings → Secrets and variables → Actions** أضف:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (مفتاح `sb_publishable_` العام)
   - `VITE_TELEGRAM_BOT_USERNAME` و`VITE_VAPID_PUBLIC_KEY` عند الحاجة فقط.
3. أضف عنوان GitHub Pages المنشور إلى **Supabase → Authentication → URL Configuration** كـSite URL وRedirect URL، ثم ادفع commit إلى `main` لمتابعة النشر.

يستخدم بناء GitHub Pages المسار `/publish-planner/`، بينما يبقى بناء Vercel على جذر الموقع.

## النشر على Netlify

1. اربط المستودع بموقع Netlify.
2. استخدم أمر البناء `npm run build` ومجلد النشر `dist`.
3. أضف `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` و`VITE_TELEGRAM_BOT_USERNAME` من إعدادات الموقع، ثم أعد البناء والنشر.
4. أضف عنوان الموقع المنشور في إعدادات عناوين إعادة التوجيه في Supabase Auth.

## ملاحظات

- يلزم تفعيل Supabase Realtime لجدول `public.content_items` من إعدادات قاعدة البيانات كي تتحدث القائمة مباشرة.
- يقرأ التطبيق منطقة المستخدم الزمنية من `profiles.timezone`. يمكن تغييرها من صفحة الإعدادات.
- يجب أن تسمح سياسات RLS للمستخدم بقراءة صفوفه وإدارتها فقط؛ لا تستخدم مفتاح الخدمة في المتصفح.

## إعداد بوت تيليجرام ونشر Edge Function

1. افتح تيليجرام وتحدث مع **@BotFather**، ثم أرسل `/newbot`. اختر اسمًا واسم مستخدم ينتهي بـ `bot`، واحفظ التوكن بسرية. ضع اسم المستخدم، من دون `@`، في `VITE_TELEGRAM_BOT_USERNAME` محليًا وفي إعدادات بيئة النشر، ثم أعد بناء الواجهة.
2. سجّل الدخول واربط مجلد Supabase بالمشروع (مرة واحدة)، ثم طبّق ترحيل `0002`:

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

   أو شغّل `supabase/migrations/0002_telegram_link_rate_limit.sql` من SQL Editor. يضيف الترحيل حدًا ذريًا لمحاولات الربط ودالة ربط تتحقق من الكود وتحدّث الملف الشخصي داخل المعاملة نفسها.
3. جهّز التوكن وسر webhook. يجب أن يتكون السر من أحرف وأرقام وشرطة سفلية أو شرطة، مثل ناتج `openssl rand -hex 32`. من جذر المشروع، خزّن الأسرار في Supabase:

   ```bash
   supabase secrets set \
     TELEGRAM_BOT_TOKEN="توكن-البوت" \
     TELEGRAM_WEBHOOK_SECRET="سر-webhook" \
     SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co" \
     SUPABASE_SERVICE_ROLE_KEY="مفتاح-service-role"
   ```

   لا تضع التوكن أو مفتاح الخدمة في `.env` الخاص بالواجهة أو في المستودع.
4. أعد نشر webhook بعد إضافة أزرار «تم النشر» و«تأجيل» و«إلغاء». يتحقق webhook من سر Telegram بدل تحقق JWT:

   ```bash
   supabase functions deploy telegram-webhook --no-verify-jwt
   ```

5. اضبط webhook. عيّن `TELEGRAM_BOT_TOKEN` و`TELEGRAM_WEBHOOK_SECRET` في طرفيتك دون إضافتهما إلى ملفات المشروع، ثم نفّذ:

   ```bash
   curl --fail-with-body --request POST \
     --url "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
     --header "Content-Type: application/json" \
     --data "{\"url\":\"https://YOUR_PROJECT_REF.supabase.co/functions/v1/telegram-webhook\",\"secret_token\":\"${TELEGRAM_WEBHOOK_SECRET}\",\"allowed_updates\":[\"message\",\"callback_query\"]}"
   ```

   يرسل Telegram قيمة `secret_token` في `X-Telegram-Bot-Api-Secret-Token` مع كل تحديث. تحقق من الإعداد باستخدام `getWebhookInfo`.
6. اضبط قائمة الأوامر بالعربية:

   ```bash
   curl --fail-with-body --request POST \
     --url "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands" \
     --header "Content-Type: application/json" \
     --data '{"commands":[{"command":"start","description":"ربط الحساب أو بدء الاستخدام"},{"command":"today","description":"مواعيد اليوم"},{"command":"upcoming","description":"أقرب خمسة مواعيد"},{"command":"done","description":"تسجيل موعد تم نشره"},{"command":"unlink","description":"فك ربط الحساب"},{"command":"help","description":"عرض المساعدة"}]}'
   ```

## التذكيرات المجدولة عبر pg_cron وpg_net

1. طبّق ترحيل `supabase/migrations/0003_reminder_delivery.sql` باستخدام `supabase db push`. يبقي `reminder_sent_at` للتوافق مع الواجهة القديمة ويسجّل وقت أول تذكير ناجح؛ العمودان `pre_reminder_sent_at` و`final_reminder_sent_at` هما المصدر الدقيق لكل مرحلة. كما يضيف علامة `reminder_missed_at` وحجزًا ذريًا برمز يمنع عميلين من إرسال الموعد نفسه معًا.
2. أضف الأسرار التالية عبر `supabase secrets set`؛ استخدم قيمة `CRON_SECRET` عشوائية واحفظ القيمة نفسها لاستخدامها في Vault:

   ```bash
   supabase secrets set \
     TELEGRAM_BOT_TOKEN="توكن-البوت" \
     CRON_SECRET="سر-عشوائي-قوي" \
     SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co" \
     SUPABASE_SERVICE_ROLE_KEY="مفتاح-service-role"
   ```

3. من **Supabase Dashboard → Integrations → Vault** أنشئ سرّين:
   - `cron_secret`: القيمة نفسها تمامًا التي وضعتها في `CRON_SECRET`.
   - `supabase_url`: عنوان المشروع مثل `https://YOUR_PROJECT_REF.supabase.co`.

   لا تضع القيم السرية داخل ملف SQL أو المستودع. يستخدم [scheduler.sql](./supabase/scheduler.sql) Vault لقراءة السر عند استدعاء الدالة.
4. انشر الدالة المحمية بترويسة `x-cron-secret`:

   ```bash
   supabase functions deploy send-reminders --no-verify-jwt
   ```

5. شغّل [scheduler.sql](./supabase/scheduler.sql) من SQL Editor بصلاحية مدير قاعدة البيانات. يفعّل `pg_cron` و`pg_net` ويضبط المهمة `send-reminders-every-minute` كل دقيقة. استخدم [unschedule_reminders.sql](./supabase/unschedule_reminders.sql) لإيقافها أو حذفها.
6. للحماية من التكرار، يحجز `claim_due_reminders` الصفوف ذريًا باستخدام `FOR UPDATE SKIP LOCKED` ثم يضع claim token لمدة 5 دقائق إلى أن تُسجّل النتيجة. لا يستطيع تشغيل متزامن المطالبة بالصف نفسه، ويصبح claim عالقًا قابلًا للاسترداد بعد انتهاء مهلة الخمس دقائق. تُعاد المحاولة حتى 3 مرات، ويؤجل 429 وفق `retry_after`. يوزّع مُحدّد الإرسال العالمي الرسائل بفاصل 50ms؛ تعالج كل استدعاءة حتى 100 موعد.

   لتجنب تكرار الرسائل عند انقطاع الاتصال بعد احتمال قبول Telegram للرسالة، لا تُعاد محاولة أخطاء الشبكة أو HTTP 5xx، ويبقى claim محفوظًا إذا توقفت الدالة قبل تسجيل النتيجة. هذا يحقق at-most-once لكل نسخة موعد، لكنه قد يفوّت رسالة في حالة فشل ملتبسة؛ لا يوفّر Telegram Bot API مفتاح idempotency أو ضمان exactly-once. الـ claims العالقة تُغلق كفائتة بعد تجاوز الموعد ست ساعات.

### اختبار يدوي

1. استبدل `USER_UUID` بمعرّف مستخدم فعلي من **Authentication → Users**، وتأكد أن حسابه مربوط بتيليجرام. شغّل SQL التالي:

   ```sql
   insert into public.content_items (
     user_id, title, content_type, platform, scheduled_at, remind_before_minutes, note
   )
   values (
     'USER_UUID',
     'اختبار تذكير تيليجرام',
     'reel',
     'instagram',
     now() + interval '2 minutes',
     2,
     'رسالة اختبار يدوية'
   )
   returning id, scheduled_at;
   ```

   قيمة `remind_before_minutes = 2` تجعل التذكير المسبق مستحقًا وقت إدخال الصف؛ تذكير الموعد النهائي يبقى بعد دقيقتين.
2. عيّن `CRON_SECRET` محليًا بالقيمة الآمنة المخزنة في Supabase Secrets، ثم استدع الدالة يدويًا. في PowerShell استخدم `curl.exe`:

   ```powershell
   $env:CRON_SECRET = "القيمة-المحفوظة-بشكل-آمن"
   $body = "{}"
   curl.exe --fail-with-body --request POST `
     --url "https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders" `
     --header "Content-Type: application/json" `
     --header "x-cron-secret: $env:CRON_SECRET" `
     --data $body
   ```

   يجب أن يظهر JSON مثل `{"sent":1,"failed":0,"skipped":0}` وتصل الرسالة إلى المحادثة المرتبطة. لا تشغّل الطلب اليدوي في الوقت نفسه مع مهمة Cron أثناء هذا الاختبار.
3. افحص الصف باستخدام معرّفه: يجب أن يكون `pre_reminder_sent_at` غير فارغ. عند حلول `scheduled_at`، يرسل Cron التذكير النهائي ويملأ `final_reminder_sent_at`.

## كيف أتأكد أن كل شيء يعمل

1. **تذكير مسبق:** أنشئ موعدًا بعد دقيقتين مع `remind_before_minutes = 2`؛ يجب أن تصل رسالة التذكير المسبق مرة واحدة.
2. **تذكير الموعد:** انتظر `scheduled_at` وتحقق من وصول الرسالة النهائية وتعبئة `final_reminder_sent_at`.
3. **عدم التكرار عند التشغيل المزدوج:** أرسل طلبين متزامنين إلى الدالة؛ يجب ألا يُرسل أي claim مرتين.
4. **زر التأجيل:** اضغط «تأجيل 15 دقيقة» وتحقق من تغيّر `scheduled_at` وتصفير علامات التذكير ثم وصول التنبيه حسب الموعد الجديد.
5. **حظر البوت:** احظر البوت لحساب اختبار، ثم أرسل تذكيرًا؛ يجب أن يسجل الفشل ويصفّر `telegram_chat_id` دون تكرار المحاولة لذلك الحساب.
6. **موعد فات أكثر من 6 ساعات:** أنشئ موعدًا مجدولًا قديمًا لم يُرسل تذكيره؛ يجب تعبئة `reminder_missed_at` دون إرسال رسالة.
7. **موعد ملغي:** ألغِ موعدًا قبل موعده؛ يجب ألا يظهر في claims أو يُرسل له تنبيه.

## PWA وتنبيهات Web Push

### مفاتيح VAPID

ولّـد زوج مفاتيح VAPID مرة واحدة:

```bash
npx web-push generate-vapid-keys
```

ضع `VAPID_PUBLIC_KEY` و`VAPID_PRIVATE_KEY` الناتجين في Supabase Secrets؛ لا تضع المفتاح الخاص في الواجهة أو المستودع.

أضف العام فقط إلى متغيرات الواجهة:

```env
VITE_VAPID_PUBLIC_KEY=المفتاح-العام
```

اضبط أسرار الدوال:

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY="المفتاح-العام" \
  VAPID_PRIVATE_KEY="المفتاح-الخاص" \
  VAPID_SUBJECT="mailto:admin@example.com" \
  SUPABASE_ANON_KEY="مفتاح-anon"
```

لـ `VAPID_SUBJECT` استخدم عنوانًا صالحًا مثل `mailto:you@example.com`.

### نشر ودعم PWA

```bash
npm install
npm run generate-icons
npm run build
npx supabase db push
supabase functions deploy send-reminders --no-verify-jwt
supabase functions deploy test-push --no-verify-jwt
supabase functions deploy reminder-action --no-verify-jwt
```

يستخدم البناء `vite-plugin-pwa` مع استراتيجية `injectManifest` وملف [src/sw.ts](./src/sw.ts). يُضاف app shell فقط إلى الكاش؛ لا تُخزّن استجابات Supabase أو بيانات المواعيد في الكاش.

### ملاحظات المنصات

- أندرويد Chrome وديسكتوب Chrome/Edge يدعمان التثبيت وWeb Push حسب إعدادات المتصفح.
- iOS/iPadOS تحتاج iOS 16.4 أو أحدث وتثبيت الموقع إلى الشاشة الرئيسية قبل طلب Web Push.
- لن تصل إشعارات المتصفح إذا رفض المستخدم الإذن أو عطّل إشعارات الموقع من إعدادات المتصفح.
- موفّر البطارية أو وضع توفير الطاقة قد يؤخر أو يمنع وصول الإشعار، خاصةً في الهواتف.
- HTTPS مطلوب. يعمل التثبيت والتطوير المحلي على `http://localhost` أيضًا.

### الأمان والخدمة

تستخدم دوال `test-push` و`reminder-action` مصادقة JWT وتستخرج المستخدم من الجلسة، ولا تقبل معرّف مستخدم من العميل. يخزّن التطبيق access token المحدّث ومفتاح Supabase العام ومفتاح VAPID العام في IndexedDB؛ لا يخزّن خدمة الدور أو التوكن الخاص.

عند عدم توفر توكن في service worker، يفتح الإشعار التطبيق بدل تعديل موعد مباشرةً.

## كيف أتأكد أن كل شيء يعمل

1. **التثبيت:** افتح الموقع عبر HTTPS وشاهد زر «تثبيت التطبيق» في الإعدادات؛ ثبّته وافتحه كنافذة standalone.
2. **الإذن:** فعّل «تنبيهات التطبيق» عبر ضغط المستخدم، وتأكد أن الإذن أصبح Granted وأن الزر يظهر «مفعّل».
3. **الاشتراك:** في Supabase تحقق من وجود صف في `push_subscriptions` لنفس المستخدم وبنفس endpoint الحالي.
4. **تنبيه تجريبي والمتصفح مقفول:** اضغط «إرسال تنبيه تجريبي» وأغلق المتصفح أو افتح نافذة أخرى؛ يجب وصول التنبيه خلال ثوانٍ على منصة داعمة.
5. **زر تم النشر:** اضغط «تم النشر ✅» داخل إشعار موعد وتأكد أن status أصبح `published` وأن الموعد اختفى من مجدول.
6. **اشتراك منتهي:** احذف اشتراكًا قديمًا أو استخدم endpoint غير صالح؛ يجب حذف الصف عند 404/410.
7. **إيقاف قناة:** أوقف «تنبيهات التطبيق» وتأكد من unsubscribe وحذف الصف؛ ثم أوقف تيليجرام وتأكد من عدم استخدام chat_id.
8. **iOS:** افتح من iPhone، تحقق من ظهور تعليمات مشاركة ← إضافة إلى الشاشة الرئيسية، وبعد التثبيت فعّل الإشعارات وتجرّب التنبيه التجريبي.

## المراجعة والنشر النهائي

- تقرير المراجعة الأمنية والمنطقية والأداء: [AUDIT_REPORT.md](./AUDIT_REPORT.md).
- الدليل التنفيذي للإنتاج: [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md).
- استعلامات المراقبة: [supabase/monitoring.sql](./supabase/monitoring.sql).
- التنظيف الأسبوعي: [supabase/maintenance.sql](./supabase/maintenance.sql).
- تنبيه أخطاء المشرف عبر Telegram: [supabase/cron_alert.sql](./supabase/cron_alert.sql).

## المعمارية

```text
React PWA ←→ Supabase Auth / Postgres / Realtime
     │                         │
     ├─ Service Worker ← Web Push API
     │
     └─ Edge reminder-action / test-push

pg_cron → pg_net → send-reminders → Telegram API
                               └→ Web Push

Telegram users → setWebhook → telegram-webhook → PostgreSQL RPC
```

## استكشاف الأخطاء

- **لا يصل تنبيه:** تحقق من إذن المتصفح، من اشتراك `push_subscriptions`، ومن إعداد `push_enabled`. للـiOS يجب تثبيت PWA على الشاشة الرئيسية.
- **البوت لا يرد:** تحقق من `TELEGRAM_WEBHOOK_SECRET` ومن `setWebhook/getWebhookInfo` ومن أن الدالة منشورة `--no-verify-jwt`.
- **لا يصل Telegram:** تحقق من `telegram_enabled` و`telegram_chat_id` ومن عدم حظر البوت ومن سجل 403 في delivery log.
- **مرتين في الإرسال:** تحقق من أن cron لا تنشأ مرتين وأن claim migration أحدث وأن `reminder_claim_token` يُفحص في الخادم.
- **الفشل بعد تغيير المنطقة:** افحص أن الموعد مخزن بصيغة timestamptz وأن العرض يستخدم `profiles.timezone`.
- **iOS لا يقبل Push:** تحقق من iOS 16.4+ ومن وضع standalone ومن HTTPS.

## جاهزية الإطلاق

1. لا توجد أسرار حقيقية في Git أو المتغيرات العامة `VITE_`.
2. مفاتيح VAPID الإنتاج منشأة ومفصولة عن التطوير.
3. migrations من 0001 إلى 0005 طبقت على مشروع إنتاج منفصل.
4. RLS واشتراكات Push وملفات المستخدم معزولة وتم تشغيل اختبارات العزل.
5. Telegram webhook وsecret وsetMyCommands وcallback تعمل.
6. Cron وVault وpg_net منشأة والمهمة تعمل كل دقيقة.
7. قنوات Telegram وPush وحقول التفعيل والإيقاف تعمل.
8. PWA مثبتة وأيقوناتها وmanifest وoffline جاهزة.
9. Auth confirmations وRedirect URLs والدومين والإيميلات العربية جاهزة.
10. CSP وترويسات الأمان وHTTPS وSPAfallback نشطة.
11. نسخ احتياطي وPITR مجربان وخطة rollback موثقة.
12. المراقبة والتنظيف والتنبيه والمراقبة اليومية مجربة في الإنتاج.
