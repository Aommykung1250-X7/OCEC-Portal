import { expect, test } from '@playwright/test';
import { closeFixtures, createSchoolFinalFixture, finalClaimState, makeHeatSelfOwned } from './fixtures.js';

test.afterAll(closeFixtures);

test('school applicant chooses an exam verifies phone then logs in with chosen Google account', async ({ page }) => {
  const fixture = await createSchoolFinalFixture();
  await page.goto('/final/confirm');
  await page.getByLabel('ชื่อและนามสกุลภาษาอังกฤษ').fill(fixture.name);
  await page.getByRole('button', { name: 'ค้นหาสิทธิ์ Final' }).click();
  await expect(page.getByLabel('เลือกรายการสอบ')).toContainText('Big Bay Bei');
  await expect(page.locator('.final-rights-school-panel')).not.toContainText(fixture.name);
  await expect(page.locator('.final-rights-school-panel')).not.toContainText('Browser School');
  await page.getByLabel('เลือกรายการสอบ').selectOption(fixture.roundId);
  await page.getByLabel('เลข 4 ตัวท้ายของเบอร์โทรศัพท์').fill('5678');
  await page.getByRole('button', { name: 'ยืนยันตัวตน' }).click();
  await expect(page.getByText('ยืนยันเบอร์โทรศัพท์แล้ว')).toBeVisible();
  await page.getByRole('button', { name: 'เข้าสู่ระบบ Google แล้วสมัคร' }).click();
  await expect(page.getByText(fixture.name)).toBeVisible();
  await page.getByRole('button', { name: 'สมัคร Final' }).click();
  await expect(page).toHaveURL(/\/apply\/final/);
  await expect(page.locator('input[value="Browser School"]')).toHaveCount(1);
  const submission = {
    source: 'final', sourceHeatApplicationId: fixture.heatApplicationId,
    applicant: { firstNameEn: fixture.firstName, lastNameEn: fixture.lastName, dateOfBirth: '2017-01-01', schoolName: 'Browser School', contactEmail: fixture.contactEmail, contactPhone: '0812345678' },
    items: [{ roundId: fixture.roundId, gradeId: fixture.gradeId, format: 'paper', centerId: fixture.centerId }],
    slip: { fileName: 'payment.png', mimeType: 'image/png', dataBase64: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString('base64') },
  };
  const submitted = await page.request.post('/api/applications/submit', { data: submission });
  expect(submitted.status(), await submitted.text()).toBe(201);
  const claim = await finalClaimState(fixture.heatApplicationId);
  expect(claim).toHaveLength(1);
  expect(claim[0].claimed_at).not.toBeNull();
  expect(claim[0].owner_user_id).not.toBe(fixture.coordinatorId);
  const replay = await page.request.post('/api/applications/submit', { data: submission });
  expect([403, 409]).toContain(replay.status());
});

test('guest Final submission is unavailable', async ({ page }) => {
  await page.goto('/final/confirm');
  await expect(page.getByRole('button', { name: 'สมัครต่อโดยไม่เข้าสู่ระบบ' })).toHaveCount(0);
  await page.goto('/apply/final');
  await expect(page.locator('body')).toContainText('ยืนยันสิทธิ์ก่อนสมัคร Final');
});

test('self applicant continues only with the Heat owner Google account', async ({ page }) => {
  const fixture = await createSchoolFinalFixture();
  await page.goto('/api/auth/google/start?returnTo=/final/confirm&testPersona=candidate');
  await makeHeatSelfOwned(fixture.heatApplicationId);
  await page.reload();
  await page.getByRole('tab', { name: 'สมัครด้วยบัญชีตนเอง' }).click();
  await expect(page.getByText(fixture.name)).toBeVisible();
  const choices = await page.request.get('/api/applications/final-eligibility');
  expect(choices.ok()).toBeTruthy();
  expect(JSON.stringify(await choices.json())).toContain(fixture.heatApplicationId);
  await page.request.post('/api/auth/logout');
  await page.goto('/api/auth/google/start?returnTo=/final/confirm&testPersona=coordinator');
  const otherChoices = await page.request.get('/api/applications/final-eligibility');
  expect(JSON.stringify(await otherChoices.json())).not.toContain(fixture.heatApplicationId);
});

test('concurrent school claims create one Final application', async ({ page }) => {
  const fixture = await createSchoolFinalFixture();
  const verified = await page.request.post('/api/public/final-eligibility/verify', { data: { candidateName: fixture.name, finalRoundId: fixture.roundId, phoneLast4: '5678' } });
  expect(verified.status(), await verified.text()).toBe(200);
  await page.goto('/api/auth/google/start?flow=final&returnTo=/final/confirm&testPersona=candidate');
  const submission = {
    source: 'final', sourceHeatApplicationId: fixture.heatApplicationId,
    applicant: { firstNameEn: fixture.firstName, lastNameEn: fixture.lastName, dateOfBirth: '2017-01-01', schoolName: 'Browser School', contactEmail: fixture.contactEmail, contactPhone: '0812345678' },
    items: [{ roundId: fixture.roundId, gradeId: fixture.gradeId, format: 'paper', centerId: fixture.centerId }],
    slip: { fileName: 'payment.png', mimeType: 'image/png', dataBase64: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString('base64') },
  };
  const responses = await Promise.all([page.request.post('/api/applications/submit', { data: submission }), page.request.post('/api/applications/submit', { data: submission })]);
  const statuses = responses.map((response) => response.status()).sort();
  expect(statuses[0]).toBe(201);
  expect([403, 409]).toContain(statuses[1]);
  expect(await finalClaimState(fixture.heatApplicationId)).toHaveLength(1);
});

test('OAuth cancellation allows verification retry', async ({ page }) => {
  const fixture = await createSchoolFinalFixture();
  await page.goto('/final/confirm');
  await page.getByLabel('ชื่อและนามสกุลภาษาอังกฤษ').fill(fixture.name);
  await page.getByRole('button', { name: 'ค้นหาสิทธิ์ Final' }).click();
  await page.getByLabel('เลือกรายการสอบ').selectOption(fixture.roundId);
  await page.getByLabel('เลข 4 ตัวท้ายของเบอร์โทรศัพท์').fill('5678');
  await page.getByRole('button', { name: 'ยืนยันตัวตน' }).click();
  await expect(page.getByText('ยืนยันเบอร์โทรศัพท์แล้ว')).toBeVisible();
  const cancelled = await page.request.get('/api/auth/google/callback?error=access_denied');
  expect(cancelled.status()).toBe(400);
  await page.reload();
  await page.getByLabel('ชื่อและนามสกุลภาษาอังกฤษ').fill(fixture.name);
  await page.getByRole('button', { name: 'ค้นหาสิทธิ์ Final' }).click();
  await page.getByLabel('เลือกรายการสอบ').selectOption(fixture.roundId);
  await page.getByLabel('เลข 4 ตัวท้ายของเบอร์โทรศัพท์').fill('5678');
  await page.getByRole('button', { name: 'ยืนยันตัวตน' }).click();
  await page.getByRole('button', { name: 'เข้าสู่ระบบ Google แล้วสมัคร' }).click();
  await expect(page.getByText(fixture.name)).toBeVisible();
});
