import { expect, test } from '@playwright/test';

test('login page is Arabic RTL and exposes both auth modes', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: /كل موعد نشر/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'تسجيل الدخول' })).toBeVisible();
  await page.getByRole('tab', { name: 'حساب جديد' }).click();
  await expect(page.getByRole('button', { name: 'إنشاء حساب' })).toBeVisible();
  await page.screenshot({ path: `test-results/login-${test.info().project.name}.png`, fullPage: true });
});

test('authenticated publishing flow', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  test.skip(!email || !password, 'يتطلب TEST_USER_EMAIL وTEST_USER_PASSWORD في البيئة.');

  await page.goto('/login');
  await page.getByLabel('البريد الإلكتروني').fill(email!);
  await page.getByLabel('كلمة المرور').fill(password!);
  await page.getByRole('button', { name: 'دخول إلى حسابي' }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByLabel(/عنوان المحتوى/).fill(`اختبار نشر ${Date.now()}`);
  await page.getByLabel(/التاريخ/).fill('2099-12-31');
  await page.getByLabel(/الساعة/).fill('21:30');
  await page.getByRole('button', { name: 'إضافة إلى الخطة' }).click();
  await expect(page.getByText(/أُضيف الموعد إلى خطتك/)).toBeVisible();

  let itemCard = page.locator('article.item-card').filter({ hasText: 'اختبار نشر' }).first();
  await itemCard.getByRole('button', { name: /تعديل/ }).click();
  await page.getByLabel(/عنوان المحتوى/).fill(`اختبار نشر معدل ${Date.now()}`);
  await page.getByRole('button', { name: 'حفظ التعديلات' }).click();
  await expect(page.getByText(/تم تحديث الموعد بنجاح/)).toBeVisible();

  itemCard = page.locator('article.item-card').filter({ hasText: 'اختبار نشر معدل' }).first();
  await itemCard.getByRole('button', { name: 'تم النشر' }).click();
  await expect(page.getByText(/تم تسجيل المحتوى كمنشور/)).toBeVisible();

  itemCard = page.locator('article.item-card').filter({ hasText: 'اختبار نشر معدل' }).first();
  page.once('dialog', (dialog) => dialog.accept());
  await itemCard.getByRole('button', { name: /حذف/ }).click();
  await expect(page.getByText(/تم حذف الموعد/)).toBeVisible();

  await page.screenshot({ path: `test-results/dashboard-${test.info().project.name}.png`, fullPage: true });
});
