# دليل النشر للإنتاج

## 1) مشروع Supabase منفصل

1. أنشئ مشروعًا للإنتاج باسم خاص ولا تستخدم project ref التطوير.
2. سجّل الدخول واربط المشروع:

   ```bash
   supabase login
   supabase link --project-ref YOUR_PRODUCTION_REF
   ```

3. طبّق الترحيلات بالترتيب:

   ```bash
   supabase db push
   ```

   أو نفّذ:
   `0001_init.sql` ← `0002_telegram_link_rate_limit.sql` ← `0003_reminder_delivery.sql` ← `0004_push_notifications.sql` ← `0005_reminder_monitoring.sql`.

4. فعّل Realtime لجدول `public.content_items`.

## 2) الأسرار

لا تضف قيمًا إلى Git أو متغيرات `VITE_`.

```bash
npx web-push generate-vapid-keys

supabase secrets set \
  TELEGRAM_BOT_TOKEN="..." \
  TELEGRAM_WEBHOOK_SECRET="..." \
  CRON_SECRET="..." \
  SUPABASE_URL="https://YOUR_PRODUCTION_REF.supabase.co" \
  SUPABASE_ANON_KEY="..." \
  SUPABASE_SERVICE_ROLE_KEY="..." \
  VAPID_PUBLIC_KEY="..." \
  VAPID_PRIVATE_KEY="..." \
  VAPID_SUBJECT="mailto:admin@example.com" \
  APP_ORIGIN="https://app.example.com"
```

قائمة واجهة النشر:

```env
VITE_SUPABASE_URL=https://YOUR_PRODUCTION_REF.supabase.co
VITE_SUPABASE_ANON_KEY=public-anon-key-only
VITE_TELEGRAM_BOT_USERNAME=your_bot_username
VITE_VAPID_PUBLIC_KEY=public-vapid-key
```

أنشئ في Vault أسماء `supabase_url` و`cron_secret` بقيمتا `SUPABASE_URL` و`CRON_SECRET`. اختياريًا أنشئ `telegram_bot_token` و`admin_telegram_chat_id` لصيق التنبيه.

## 3) نشر الدوال

```bash
supabase functions deploy telegram-webhook --no-verify-jwt
supabase functions deploy reminder-action --no-verify-jwt
supabase functions deploy test-push --no-verify-jwt
```

يجب أن يكون اسم الدالة الأخير `send-reminders` (تكتب الشرطة فقط):

```bash
supabase functions deploy send-reminders --no-verify-jwt
```

## 4) تيليجرام الإنتاج

1. أنشئ بوتًا جديدًا عبر @BotFather.
2. عيّن الحقول الناتجة في `TELEGRAM_BOT_TOKEN` و`VITE_TELEGRAM_BOT_USERNAME`.
3. اضبط Webhook:

```bash
curl --fail-with-body -X POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://YOUR_PRODUCTION_REF.supabase.co/functions/v1/telegram-webhook\",\"secret_token\":\"${TELEGRAM_WEBHOOK_SECRET}\",\"allowed_updates\":[\"message\",\"callback_query\"]}"
```

4. اضبط الأوامر العربية عبر `setMyCommands`.

## 5) Cron وVault

شغّل في SQL Editor بالإعدادات الإنتاجية:

```sql
-- supabase/scheduler.sql
```

وتأكد أن المهمة تعمل كل دقيقة وأن صفوف cron بدون أخطاء. لتفعيل التنظيف والإنذارات شغّل `supabase/maintenance.sql` و`supabase/cron_alert.sql`.

## 6) واجهة Vercel

```bash
npm ci
npm run generate-icons
npm run build
npx vercel --prod
```

أو اربط المستودع بـNetlify وشغّل `npm run build` مع مخرجات `dist`.

استخدم فقط متغيرات `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` و`VITE_TELEGRAM_BOT_USERNAME` و`VITE_VAPID_PUBLIC_KEY`. لا تستخدم متغيرات سرية من نوع `SUPABASE_SERVICE_ROLE_KEY`.

## 7) Auth والدومين

1. فعّل Email confirmations في Supabase.
2. ضع domínio الإنتاج في Site URL وRedirect URLs.
3. ترجم قوالب تأكيد الإيميل إلى العربية.
4. اربط DNS وشهادات HTTPS.
5. حدّث manifest واسم البوت ورابطه إذا تغيّر الدومين.

## 8) النسخ والتراجع

- فعّل Daily/PITR Backups من Supabase Dashboard حسب الخطة.
- اختبر الاستعادة في مشروع staging، لا تستورد نسخًا مباشرةً إلى الإنتاج دون تحقق.
- عند فشل migration، وقف cron أولًا (`supabase/unschedule_reminders.sql`) واحفظ نسخة قاعدة البيانات.
- Rollback للواجهة: أعد إصدار Vercel/Netlify السابق.
- لا تنزل migration باليد إذا اعتمدت عليها الدوال؛ عدّلها بمigration تصحيحية جديدة.
