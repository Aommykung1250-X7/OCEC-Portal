import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import readXlsxFile from 'read-excel-file/node';
import { closeFixtures, createPastPaperFixture, createReviewFixture, createSchoolFinalFixture, replacementTokenFor } from './fixtures.js';

test.afterAll(closeFixtures);

async function adminPage(page, id) {
  await page.goto(`/api/auth/google/start?returnTo=${encodeURIComponent(`/portal-admin/applications/${id}`)}&testPersona=admin`);
  await expect(page).toHaveURL(new RegExp(`/portal-admin/applications/${id}`));
  await expect(page.locator('.review-detail')).toBeVisible();
}

test('admin can reject with reason and applicant receives same reason by email', async ({ page }) => {
  const fixture = await createReviewFixture();
  await adminPage(page, fixture.id);
  await page.getByRole('button', { name: 'ไม่อนุมัติใบสมัคร' }).click();
  const dialog = page.getByRole('dialog', { name: 'ไม่อนุมัติใบสมัคร?' });
  await dialog.getByLabel('เหตุผลที่ไม่อนุมัติ').fill('ข้อมูลไม่ครบสำหรับรอบนี้');
  await dialog.getByRole('button', { name: 'ยืนยันไม่อนุมัติ' }).click();
  await expect(dialog).not.toBeVisible();
  const response = await page.request.post('/api/public/applications/status', { data: { name: fixture.name } });
  expect(response.ok()).toBeTruthy();
  const status = await response.json();
  expect(JSON.stringify(status)).toContain('ข้อมูลไม่ครบสำหรับรอบนี้');
  expect(JSON.stringify(status)).not.toContain('adminNotes');
  await page.goto('/status');
  await page.getByPlaceholder('กรอกชื่อและนามสกุลภาษาอังกฤษ').fill(fixture.name);
  await page.locator('.lookup-card').getByRole('button', { name: 'ค้นหาสถานะ' }).click();
  await expect(page.locator('.status-result')).toContainText('เหตุผล: ข้อมูลไม่ครบสำหรับรอบนี้');
  await expect(page.locator('.status-result')).not.toContainText('บันทึกภายใน');
});

test('direct slip-upload URL cannot claim local-only success', async ({ page }) => {
  await page.goto('/slip-upload/fake-id');
  await expect(page.locator('body')).toContainText('ลิงก์');
  await expect(page.getByText(/อัปโหลดสลิปสำเร็จ/)).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});

test('admin issues a replacement link only after API success', async ({ page }) => {
  const fixture = await createReviewFixture();
  await adminPage(page, fixture.id);
  await page.route(`**/api/admin/applications/${fixture.id}/review`, async (route) => {
    if (route.request().method() === 'PATCH') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'slip test failure' }) });
    return route.continue();
  });
  await page.getByRole('button', { name: 'สลิปไม่ถูกต้อง' }).click();
  await expect(page.locator('.toast')).toContainText('slip test failure');
  await expect(page.locator('.review-detail')).not.toContainText('สลิปมีปัญหา');
  await page.unroute(`**/api/admin/applications/${fixture.id}/review`);
  await page.getByRole('button', { name: 'สลิปไม่ถูกต้อง' }).click();
  await expect(page.locator('.review-detail')).toContainText('สลิปมีปัญหา');
  await expect(page.locator('.toast')).toContainText('สร้างลิงก์ใช้ครั้งเดียว');
});

test('approve action shows success only after API response', async ({ page }) => {
  const fixture = await createReviewFixture();
  await adminPage(page, fixture.id);
  const approve = page.getByRole('button', { name: 'อนุมัติใบสมัคร', exact: true });
  await expect(approve).toBeEnabled();
  await page.route(`**/api/admin/applications/${fixture.id}/review`, async (route) => {
    if (route.request().method() === 'PATCH') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'approval blocked by test' }) });
    return route.continue();
  });
  await approve.click();
  await expect(page.locator('.toast')).toContainText('approval blocked by test');
  const pending = await page.request.get('/api/admin/applications');
  expect(JSON.stringify(await pending.json())).toContain(fixture.id);
  await page.unroute(`**/api/admin/applications/${fixture.id}/review`);
  await approve.click();
  await expect(page.locator('.toast')).toContainText('อนุมัติใบสมัครแล้ว');
  const status = await page.request.post('/api/public/applications/status', { data: { name: fixture.name } });
  expect(JSON.stringify(await status.json())).toContain('confirmed');
});

test('replacement link uploads once and rejects replay', async ({ page }) => {
  const fixture = await createReviewFixture();
  await adminPage(page, fixture.id);
  await page.getByRole('button', { name: 'สลิปไม่ถูกต้อง', exact: true }).click();
  await expect(page.locator('.review-detail')).toContainText('สลิปมีปัญหา');
  const token = await replacementTokenFor(fixture.email);
  await page.goto(`/slip-replacement?token=${encodeURIComponent(token)}`);
  await page.locator('.file-drop input[type="file"]').setInputFiles({ name: 'new-slip.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]) });
  await page.getByRole('button', { name: 'ส่งสลิปใหม่' }).click();
  await expect(page.locator('.upload-success')).toContainText('ได้รับสลิปใหม่แล้ว');
  const replay = await page.request.post('/api/slip-replacements/submit', { data: { token, slip: { fileName: 'new-slip.png', mimeType: 'image/png', dataBase64: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString('base64') } } });
  expect(replay.status()).toBe(410);
  const invalid = await page.request.post('/api/slip-replacements/validate', { data: { token } });
  expect(invalid.status()).toBe(410);
});

test('admin selects an approved Mock batch before adding it to the yearly Google Sheet', async ({ page }) => {
  const fixture = await createSchoolFinalFixture();
  await page.goto(`/api/auth/google/start?returnTo=${encodeURIComponent('/portal-admin/mock-papers')}&testPersona=admin`);
  await expect(page).toHaveURL(/\/portal-admin\/mock-papers/);
  await expect(page.locator('.admin-mock-table-wrap')).toContainText(fixture.name);
  const filters = page.locator('.admin-mock-filters');
  await expect(filters.getByText('โรงเรียน')).toHaveCount(0);
  await filters.locator('select').nth(0).selectOption('BBB');
  await filters.locator('select').nth(1).selectOption('2569');
  await filters.locator('select').nth(2).selectOption('Primary 1');
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  await filters.locator('input[type="date"]').nth(0).fill(today);
  await filters.locator('input[type="date"]').nth(1).fill(today);
  let sent;
  await page.route('**/api/admin/mock-sheets/add', async (route) => {
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ selected: 1, inserted: 1, updated: 0, tab: 'BBB - Mock', spreadsheetUrl: 'https://sheets.google.test/mock#gid=8' }) });
  });
  await page.getByRole('button', { name: 'เพิ่มเข้า Google Sheet' }).first().click();
  await expect(page.getByRole('link', { name: 'เปิด Google Sheet' })).toHaveAttribute('href', 'https://sheets.google.test/mock#gid=8');
  expect(sent).toEqual({ year: '2569', competition: 'BBB', grade: 'Primary 1', startDate: today, endDate: today });
});

test('admin Excel export contains the filtered past-paper rows', async ({ page }) => {
  const fixture = await createPastPaperFixture();
  await page.goto(`/api/auth/google/start?returnTo=${encodeURIComponent('/portal-admin/mock-papers')}&testPersona=admin`);
  await page.getByRole('tab', { name: /รายการซื้อข้อสอบเก่า/ }).click();
  await page.getByPlaceholder('ค้นหาชื่อ โรงเรียน หรือข้อสอบเก่า').fill(fixture.firstName);
  await expect(page.locator('.admin-mock-table-wrap tbody tr')).toHaveCount(1);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ส่งออก Excel' }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const sheets = await readXlsxFile(await readFile(await download.path()));
  expect(sheets[0].data).toHaveLength(2);
  expect(sheets[0].data[1]).toContain(fixture.name);
  expect(sheets[0].data[1].some((cell) => String(cell).includes(fixture.paperTitle))).toBeTruthy();
});
