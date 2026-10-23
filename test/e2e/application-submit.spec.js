import { expect, test } from '@playwright/test';
import { closeFixtures } from './fixtures.js';

test.afterAll(closeFixtures);

test('applicant can complete and submit a Heat application from the migrated form', async ({ page }) => {
  await page.goto('/api/auth/google/start?returnTo=/apply&testPersona=candidate');
  await page.getByLabel('English First Name').fill('Tailwind');
  await page.getByLabel('English Last Name').fill('Applicant');
  await page.getByLabel('ชื่อ (ภาษาไทย)').fill('ผู้สมัคร');
  await page.getByLabel('นามสกุล (ภาษาไทย)').fill('ทดสอบ');
  await page.getByRole('radio', { name: 'ชาย' }).check();
  await page.getByLabel('Date of Birth / วันเกิด').fill('2012-01-15');
  await page.getByLabel('School Name / โรงเรียน').selectOption({ index: 1 });
  await page.getByLabel('Email / อีเมล').fill('tailwind-applicant@example.test');
  await page.getByLabel('Phone Number / เบอร์โทรศัพท์').fill('0812345678');
  await page.getByLabel('Address Line 1 / ที่อยู่').fill('99 ถนนสุขุมวิท');
  await page.getByLabel('District / City / เขตหรืออำเภอ').fill('วัฒนา');
  await page.getByLabel('Province / จังหวัด').fill('กรุงเทพมหานคร');
  await page.getByLabel('Postal Code / รหัสไปรษณีย์').fill('10110');

  await page.locator('.competition-select input').first().check();
  await page.locator('.competition-grade select').selectOption({ index: 1 });
  await page.locator('.competition-center-field select').selectOption({ index: 1 });
  await page.locator('input[type="file"][aria-label="แนบหลักฐานการชำระเงิน"]').setInputFiles({
    name: 'receipt.png',
    mimeType: 'image/png',
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  });
  await page.locator('.confirm-check input[type="checkbox"]').first().check();

  await page.getByRole('button', { name: 'ส่งใบสมัคร' }).click();
  await expect(page.getByRole('heading', { name: 'รายละเอียดใบสมัคร' })).toBeVisible();
  await expect(page.getByText('ส่งใบสมัครแล้ว')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tailwind Applicant' })).toBeVisible();
});
