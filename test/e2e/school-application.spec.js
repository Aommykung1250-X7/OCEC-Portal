import { expect, test } from '@playwright/test';
import { closeFixtures } from './fixtures.js';

test.afterAll(closeFixtures);

test('school application remains usable with long Thai validation text at mobile and desktop widths', async ({ page }) => {
  await page.goto('/api/auth/google/start?returnTo=/apply&testPersona=candidate');
  await page.locator('input[type="radio"][name="source"]').nth(1).click({ noWaitAfter: true });
  await expect(page.getByRole('heading', { name: 'สมัครสอบแบบโรงเรียน' })).toBeVisible();
  await page.getByLabel('English First Name').fill('ก'.repeat(120));
  await page.getByRole('button', { name: 'ส่งใบสมัคร 1 คน' }).click();
  await expect(page.getByRole('alert')).toContainText('กรุณากรอกนามสกุลภาษาอังกฤษ');

  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const metrics = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      inputFontSize: getComputedStyle(document.querySelector('.school-batch-form input[type="email"]')).fontSize,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width);
    expect(metrics.inputFontSize).toBe(width < 768 ? '16px' : '12px');
    await expect(page.getByRole('alert')).toContainText('กรุณากรอกนามสกุลภาษาอังกฤษ');
  }
});

test('school application can add, switch between, and remove applicants without losing each person’s values', async ({ page }) => {
  await page.route('**/api/catalog', async (route) => {
    const response = await route.fetch();
    const catalog = await response.json();
    await route.fulfill({ response, json: { ...catalog, pastPapers: [{ id: 'school-test-paper', group: 'Test Papers', title: 'Test Past Paper', detail: 'Browser fixture', price: 250, active: true }] } });
  });
  await page.goto('/api/auth/google/start?returnTo=/apply&testPersona=candidate');
  await page.locator('input[type="radio"][name="source"]').nth(1).click({ noWaitAfter: true });
  await expect(page.getByRole('heading', { name: 'สมัครสอบแบบโรงเรียน' })).toBeVisible();

  const applicantTabs = page.locator('.school-applicant-tab');
  await expect(applicantTabs).toHaveCount(1);
  await page.getByLabel('English First Name').fill('Ada');
  await page.getByRole('button', { name: 'เพิ่มผู้เข้าสอบ' }).click();
  await expect(applicantTabs).toHaveCount(2);
  await page.getByLabel('English First Name').fill('Grace');
  await page.locator('.past-paper-option input').check();
  await expect(page.locator('.payment-total-grid > div:nth-child(1) strong')).toHaveText('฿250');
  await expect(page.locator('.payment-total-grid > div:nth-child(3) strong')).toHaveText('฿250');
  await expect(page.locator('.school-breakdown-row').nth(0)).toContainText('฿0');
  await expect(page.locator('.school-breakdown-row').nth(1)).toContainText('฿250');

  await applicantTabs.nth(0).click();
  await expect(page.getByLabel('English First Name')).toHaveValue('Ada');
  await applicantTabs.nth(1).click();
  await expect(page.getByLabel('English First Name')).toHaveValue('Grace');
  await page.getByRole('button', { name: 'ลบใบสมัครของผู้เข้าสอบคนที่ 2' }).click();

  await expect(applicantTabs).toHaveCount(1);
  await expect(page.getByLabel('English First Name')).toHaveValue('Ada');
  await expect(page.locator('.payment-total-grid > div:nth-child(3) strong')).toHaveText('฿0');
  await expect(page.getByRole('button', { name: /ลบใบสมัครของผู้เข้าสอบ/ })).toHaveCount(0);
});
