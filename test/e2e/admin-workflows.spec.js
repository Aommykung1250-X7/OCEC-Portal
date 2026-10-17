import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import readXlsxFile from 'read-excel-file/node';
import { closeFixtures, createReviewFixture, replacementTokenFor } from './fixtures.js';

test.afterAll(closeFixtures);

async function adminPage(page, id) {
  await page.goto(`/api/auth/google/start?returnTo=${encodeURIComponent(`/portal-admin/applications/${id}`)}&testPersona=admin`);
  await expect(page).toHaveURL(new RegExp(`/portal-admin/applications/${id}`));
  await expect(page.getByRole('region', { name: 'บันทึกภายในของแอดมิน' })).toBeVisible();
}

test('admin can add edit delete and inspect note history', async ({ page }) => {
  const fixture = await createReviewFixture();
  await adminPage(page, fixture.id);
  const notes = page.getByRole('region', { name: 'บันทึกภายในของแอดมิน' });
  await notes.getByLabel('เพิ่มบันทึกภายใน').fill('ตรวจเอกสารเพิ่ม');
  await notes.getByRole('button', { name: 'เพิ่มบันทึก' }).click();
  await expect(notes.locator('.review-note')).toContainText('ตรวจเอกสารเพิ่ม');
  await notes.getByRole('button', { name: 'แก้ไข' }).click();
  await notes.getByLabel('แก้ไขบันทึกภายใน').fill('ตรวจเอกสารเรียบร้อย');
  page.once('dialog', (dialog) => dialog.accept());
  await notes.getByRole('button', { name: 'บันทึกการแก้ไข' }).click();
  await expect(notes.locator('.review-note')).toContainText('ตรวจเอกสารเรียบร้อย');
  page.once('dialog', (dialog) => dialog.accept());
  await notes.getByRole('button', { name: 'ลบ' }).click();
  await expect(notes.locator('.review-note')).toHaveCount(0);
  await notes.getByText(/ประวัติหมายเหตุ/).click();
  await expect(notes.locator('ol')).toContainText('ตรวจเอกสารเพิ่ม');
  await expect(notes.locator('ol')).toContainText('ตรวจเอกสารเรียบร้อย');
});

test('note API failures do not show success or discard draft', async ({ page }) => {
  const fixture = await createReviewFixture();
  await adminPage(page, fixture.id);
  await page.route(`**/api/admin/applications/${fixture.id}/notes`, async (route) => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'test failure' }) });
    return route.continue();
  });
  const notes = page.getByRole('region', { name: 'บันทึกภายในของแอดมิน' });
  await notes.getByLabel('เพิ่มบันทึกภายใน').fill('ต้องคงข้อความนี้');
  await notes.getByRole('button', { name: 'เพิ่มบันทึก' }).click();
  await expect(notes.getByRole('alert')).toContainText('test failure');
  await expect(notes.getByLabel('เพิ่มบันทึกภายใน')).toHaveValue('ต้องคงข้อความนี้');
  await expect(notes.locator('.review-note')).toHaveCount(0);
});

test('admin can reject with reason and applicant receives same reason by email', async ({ page }) => {
  const fixture = await createReviewFixture();
  await adminPage(page, fixture.id);
  await page.getByLabel('เหตุผลสั้น ๆ ที่ไม่อนุมัติ').fill('ข้อมูลไม่ครบสำหรับรอบนี้');
  await page.getByRole('button', { name: 'ไม่อนุมัติใบสมัคร' }).click();
  await expect(page.locator('.review-detail')).toContainText('ไม่อนุมัติ');
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

test('admin Excel export contains the filtered API application rows', async ({ page }) => {
  const fixture = await createReviewFixture();
  await page.goto(`/api/auth/google/start?returnTo=${encodeURIComponent('/portal-admin/mock-papers')}&testPersona=admin`);
  await expect(page).toHaveURL(/\/portal-admin\/mock-papers/);
  await page.getByPlaceholder('ค้นหาชื่อ โรงเรียน หรือรายการสอบ').fill(fixture.firstName);
  await expect(page.locator('.admin-mock-table-wrap')).toContainText(fixture.name);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ส่งออก Excel' }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const contents = await readFile(await download.path());
  const sheets = await readXlsxFile(contents);
  const rows = sheets[0].data;
  expect(rows).toHaveLength(2);
  expect(rows[1]).toContain(fixture.name);
});
