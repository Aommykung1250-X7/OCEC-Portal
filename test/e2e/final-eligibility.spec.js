import { expect, test } from '@playwright/test';
import { closeFixtures, createSchoolFinalFixture, finalClaimState, makeHeatSelfOwned } from './fixtures.js';

test.afterAll(closeFixtures);

test('authenticated applicant opens the Heat form with both applicant source choices', async ({ page }) => {
  await page.goto('/api/auth/google/start?returnTo=/apply&testPersona=candidate');
  await expect(page.getByRole('heading', { name: 'สมัครสอบ OCEC' })).toBeVisible();
  await expect(page.locator('input[type="radio"][name="source"]')).toHaveCount(2);
  await expect(page.getByLabel('English First Name')).toBeVisible();
  await page.getByLabel('English First Name').fill('Heat');
  await page.getByLabel('English Last Name').fill('Applicant');
  await page.getByLabel('ชื่อ (ภาษาไทย)').fill('ผู้สมัคร');
  await page.getByLabel('นามสกุล (ภาษาไทย)').fill('ทดสอบ');
  await page.locator('input[name="gender"][value="Female"]').check();
  await page.getByLabel('Date of Birth / วันเกิด').fill('2014-05-20');
  await page.getByLabel('School Name / โรงเรียน').selectOption('Bangkok Patana School');
  await page.getByLabel('Email / อีเมล').fill('heat-applicant@example.test');
  await page.getByLabel('Phone Number / เบอร์โทรศัพท์').fill('0812345678');
  await page.getByLabel('Address Line 1 / ที่อยู่').fill('123 Main Road');
  await page.getByLabel('District / City / เขตหรืออำเภอ').fill('Bangkok');
  await page.getByLabel('Province / จังหวัด').fill('Bangkok');
  await page.getByLabel('Postal Code / รหัสไปรษณีย์').fill('10110');
  await page.getByRole('button', { name: 'ส่งใบสมัคร' }).click();
  await expect(page.getByRole('alert')).toContainText('กรุณาเลือกรายการสอบอย่างน้อย 1 รายการ');
});

test('school applicant chooses an exam verifies phone then logs in with chosen Google account', async ({ page }) => {
  const fixture = await createSchoolFinalFixture({ includeDecoyFinalRound: true });
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
  await expect(page.getByRole('heading', { name: 'สมัครสอบ Final' })).toBeVisible();
  const poster = page.locator('.center-poster-preview');
  await expect(poster).toHaveCount(1);
  await expect(poster.getByRole('img', { name: 'แผนที่ศูนย์สอบ Paper Based ทั่วประเทศไทย' })).toBeVisible();
  await expect(page.locator('.competition-center-field')).toBeVisible();
  const posterPrecedesCenter = await page.evaluate(() => {
    const preview = document.querySelector('.center-poster-preview');
    const center = document.querySelector('.competition-center-field');
    return Boolean(preview && center && (preview.compareDocumentPosition(center) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(posterPrecedesCenter).toBe(true);
  await expect(page.locator(`input[value="${fixture.firstName}"]`)).toHaveCount(1);
  await expect(page.locator('input[value="Browser School"]')).toHaveCount(1);
  const selectedFinal = page.locator('.competition-card-selected');
  await expect(selectedFinal).toHaveCount(1);
  await expect(selectedFinal.locator('.competition-grade select')).toHaveValue('Primary 1');
  const finalCenterOptions = await selectedFinal.locator('.competition-center-field select option').allTextContents();
  expect(finalCenterOptions).toContain(fixture.centerName);
  expect(finalCenterOptions).not.toContain(fixture.decoyCenterName);
  const examFee = (await selectedFinal.locator('.competition-fee').innerText()).replace(/\s*\/ รายการ.*$/, '').trim();
  expect(examFee).toBe('฿1,200');
  await expect(page.locator('.payment-total-grid > div:nth-child(2) strong')).toHaveText(examFee);
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

test('Final eligibility search shows its loading and API error states on a phone viewport', async ({ page }) => {
  await createSchoolFinalFixture();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/final/confirm');
  let continueRequest;
  const requestGate = new Promise((resolve) => { continueRequest = resolve; });
  await page.route('**/api/public/final-eligibility/search', async (route) => {
    await requestGate;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'ไม่สามารถค้นหาสิทธิ์ได้ในขณะนี้' }),
    });
  });
  await page.getByLabel('ชื่อและนามสกุลภาษาอังกฤษ').fill('A Valid Applicant');
  const searchButton = page.locator('.final-rights-eligibility-search button');
  await searchButton.click();
  await expect(searchButton).toBeDisabled();
  await expect(page.getByRole('button', { name: 'กำลังค้นหา…' })).toBeVisible();
  continueRequest();
  await expect(page.getByRole('alert')).toContainText('ไม่สามารถค้นหาสิทธิ์ได้ในขณะนี้');
  const bounds = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }));
  expect(bounds.document).toBeLessThanOrEqual(bounds.viewport);
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
