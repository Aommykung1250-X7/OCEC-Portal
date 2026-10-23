import { expect, test } from '@playwright/test';
import { closeFixtures, createReviewFixture, makeHeatSelfOwned } from './fixtures.js';

test.afterAll(closeFixtures);

test('applicant can open an owned application and its detail from the existing routes', async ({ page }) => {
  const fixture = await createReviewFixture();
  await page.goto('/api/auth/google/start?returnTo=/applications&testPersona=candidate');
  await makeHeatSelfOwned(fixture.id);

  await page.goto('/applications');
  const applicationCard = page.locator('.application-card').filter({ hasText: fixture.name });
  await expect(applicationCard).toBeVisible();
  await applicationCard.getByRole('button', { name: 'ดูรายละเอียด' }).click();

  await expect(page).toHaveURL(`/applications/${fixture.id}`);
  await expect(page.getByRole('heading', { name: 'รายละเอียดใบสมัคร' })).toBeVisible();
  await expect(page.locator('.detail-summary')).toContainText(fixture.name);
  await page.getByRole('button', { name: 'กลับไปใบสมัครของฉัน' }).click();
  await expect(page).toHaveURL('/applications');
  await expect(applicationCard).toBeVisible();
});

test('applicant can search status and verify identity before opening edit access', async ({ page }) => {
  const fixture = await createReviewFixture();

  await page.goto('/status');
  await page.getByPlaceholder('กรอกชื่อและนามสกุลภาษาอังกฤษ').fill(fixture.name);
  await page.locator('.lookup-card').getByRole('button', { name: 'ค้นหาสถานะ' }).click();
  await expect(page.locator('.status-result')).toContainText(fixture.name);

  await page.goto('/edit/verify');
  await page.getByLabel('ชื่อภาษาอังกฤษตามใบสมัคร').fill(fixture.name);
  await page.getByLabel('เลข 4 ตัวท้ายของเบอร์โทรศัพท์').fill('5678');
  await page.getByRole('button', { name: 'ยืนยันและค้นหาใบสมัคร' }).click();
  await expect(page).toHaveURL(`/applications/${fixture.id}/edit`);
  await expect(page.locator('.user-edit-application-page')).toContainText(fixture.name);
  await expect(page.locator('.notice-amber')).toContainText('ยังไม่สามารถแก้ไขใบสมัครนี้ได้');
});

test('status lookup exposes loading, empty, and backend error states on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/status');
  let continueRequest;
  const requestGate = new Promise((resolve) => { continueRequest = resolve; });
  await page.route('**/api/public/applications/status', async (route) => {
    await requestGate;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ applications: [] }) });
  });
  await page.getByPlaceholder('กรอกชื่อและนามสกุลภาษาอังกฤษ').fill('No Matching Applicant');
  const searchButton = page.locator('.lookup-card form button');
  await searchButton.click();
  await expect(searchButton).toBeDisabled();
  await expect(page.getByRole('button', { name: 'กำลังค้นหา…' })).toBeVisible();
  continueRequest();
  await expect(page.locator('.lookup-results .empty-inline')).toContainText('ไม่พบใบสมัครที่ตรงกับชื่อ');

  await page.unroute('**/api/public/applications/status');
  await page.route('**/api/public/applications/status', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'ระบบค้นหาขัดข้องชั่วคราว' }),
  }));
  await page.getByPlaceholder('กรอกชื่อและนามสกุลภาษาอังกฤษ').fill('No Matching Applicant');
  await searchButton.click();
  await expect(page.locator('.lookup-results .empty-inline')).toContainText('ระบบค้นหาขัดข้องชั่วคราว');
  const bounds = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }));
  expect(bounds.document).toBeLessThanOrEqual(bounds.viewport);
});
