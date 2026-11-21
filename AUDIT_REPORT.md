# تقرير مراجعة المشروع

## حرج — مطبق

1. **صلاحيات قنوات الإشعار:** كانت سياسات `profiles` تسمح سابقًا عمود `timezone` فقط. أضيفت صلاحية authenticated لتحديث `push_enabled` و`telegram_enabled` فقط، مع سياسة الملكية.
2. **تخزين جلسة service worker:** تُحفظ الجلسة المحدّثة في IndexedDB ويُحذف access token عند تسجيل الخروج. لا توجد مفاتيح خاصة في الواجهة.
3. **حماية دوال المتصفح:** `test-push` و`reminder-action` تتحقق من JWT وتضيف CORS ورفض OPTIONS/JSON غير صالح.
4. **حماية التغيير على المواعيد:** callback يمر عبر RPC مربوط بـ `auth.uid()`؛ لا يُقبل user_id من الجسم.
5. **سرية الأسرار:** لم يُلتقط أي service role أو توكن أو VAPID private في مجلد الواجهة أو ملفات المصدر العامة.
6. **فرز claims بالقناة:** claim_due_reminders استبعد الحسابات التي أوقفت قناتيها أو لا تملك اشتراكًا Push ولم تعد مرتبطة بـTelegram.
7. **CORS الإنتاجي:** دوال المتصفح تقبل أصلًا محددًا عبر `APP_ORIGIN` وتخالفه بـ403 بدل سياسة wildcard في الإنتاج.

## مهم — مطبق

1. **عزل push_subscriptions:** RLS على الملكية مع endpoint unique وRLS test منفصل.
2. **سجل المراقبة والتنظيف:** أضيف جدول delivery log وindexes، واستعلامات فشل، ومهمة تنظيف أسبوعية قابلة للإيقاف.
3. **حماية الدفع المكرر:** `claim_due_reminders` يستخدم claim token و`FOR UPDATE SKIP LOCKED`; claim ينتهي بعد خمس دقائق.
4. **الصفوف الفائتة:** النهائي القديم أكثر من ست ساعات يُعلّم `reminder_missed_at` ولا يُرسل.
5. **حالات الإيقاف والتغيير:** snooze يغيّر الوقت ويشغّل trigger تصفير حالات التذكير. status cancelled/published مستبعد من claim.
6. **Push 404/410 و403 Telegram:** الاشتراك يُحذف عند انتهاءه؛ chat_id يُصفّر عند 403.
7. **اختبارات CI:** unit وlint وtypecheck وbuild وRLS وDeno وgitleaks.
8. **صفحة offline والترويسات:** أضيفت صفحة عربية وتكوين CSP وcache headers.

## تحسينات مقترحة

1. تفعيل pgTAP كامل داخل قاعدة Supabase بدل سكربت SQL أعرضته كاختبار أساسي.
2. إضافة لوحة مراقبة داخل التطبيق للمشرفين بدل الاعتماد على SQL فقط.
3. تقليل bundle عبر dynamic import لصفحات الإعدادات والداش.
4. إضافة Redis خارج نطاق Supabase إذا ارتفع ضغط Push فوق حد Telegram and push provider.
5. جدولة اختبار صيانة أسبوعية آليًا مع تصدير سجل audit خارج المستودع.
6. توزيع إشعارات Push بعدد مشتركين كبير على دفعات وإضافة backoff لكل اشتراك.
7. إضافة Content Security Policy report-only في أول أسبوع نشر ثم إجبارها بعد التحقق.

## ملخص Diff التطبيقي

- تحسين [0004_push_notifications.sql](./supabase/migrations/0004_push_notifications.sql): تصفية claims حسب القنوات ووجود اشتراك.
- تحسين [send-reminders/index.ts](./supabase/functions/send-reminders/index.ts): تحديد غياب اشتراك Push خارج حلقة الإرسال وتعطيل القناتين.
- تحسين [test-push/index.ts](./supabase/functions/test-push/index.ts) و[reminder-action/index.ts](./supabase/functions/reminder-action/index.ts): أصل CORS قابل للتقييد بـAPP_ORIGIN ورفض origin غير مسموح.
- تحسين [cron_alert.sql](./supabase/cron_alert.sql): تنبيه إذا كان آخر تشغيل Cron قبل خمس دقائق أو زاد الفشل في 24 ساعة.
- إضافة [rls_all_tables.sql](./supabase/tests/rls_all_tables.sql) إلى CI.
