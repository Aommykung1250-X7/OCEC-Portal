import { expect, test } from '@playwright/test';

async function catalogPage(page) {
  await page.goto(`/api/auth/google/start?returnTo=${encodeURIComponent('/portal-admin/form-options')}&testPersona=admin`);
  await expect(page).toHaveURL(/\/portal-admin\/form-options/);
  await page.locator('.admin-form-option-accordion').filter({ has: page.locator('summary', { hasText: 'ระดับชั้น' }) }).locator('summary').click();
}

test('catalog dirty state survives failed automatic save and blocks accidental navigation', async ({ page }) => {
  await catalogPage(page);
  await page.route('**/api/admin/catalog', async (route) => {
    if (route.request().method() === 'PUT') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'save blocked by test' }) });
    return route.continue();
  });
  await page.locator('#new-grade-option').fill('Browser Test Grade');
  await page.getByRole('button', { name: 'เพิ่มระดับชั้น' }).click();
  await expect(page.getByRole('alert')).toContainText('save blocked by test');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.locator('.sidebar a[href="#admin-review"]').click();
  await expect(page).toHaveURL(/\/portal-admin\/form-options/);
  await expect(page.locator('.admin-grade-catalog-list')).toContainText('Browser Test Grade');
});

test('saved catalog remains after reload', async ({ page }) => {
  await catalogPage(page);
  const saved = page.waitForResponse((response) => response.url().endsWith('/api/admin/catalog') && response.request().method() === 'PUT' && response.ok());
  await page.locator('#new-grade-option').fill('Persisted Browser Grade');
  await page.getByRole('button', { name: 'เพิ่มระดับชั้น' }).click();
  await saved;
  await expect(page.getByRole('status', { name: '' }).filter({ hasText: 'บันทึกแล้ว' })).toBeVisible();
  await page.reload();
  await page.locator('.admin-form-option-accordion').filter({ has: page.locator('summary', { hasText: 'ระดับชั้น' }) }).locator('summary').click();
  await expect(page.locator('.admin-grade-catalog-list')).toContainText('Persisted Browser Grade');
});
