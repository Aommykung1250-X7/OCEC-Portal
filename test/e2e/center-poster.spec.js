import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const testPng = readFileSync(new URL('../../public/paper-based-centers-poster.png', import.meta.url));
const upload = { mimeType: 'image/png', dataBase64: testPng.toString('base64') };


async function signIn(page, persona, returnTo) {
  await page.goto(`/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}&testPersona=${persona}`);
  await expect(page).toHaveURL(new RegExp(`${returnTo.replaceAll('/', '\\/')}$`));
}

test('public poster read serves an image and anonymous writes require admin access', async ({ page }) => {
  const poster = await page.request.get('/api/center-poster');
  expect(poster.status(), await poster.text()).toBe(200);
  expect(poster.headers()['content-type']).toMatch(/^image\/(png|jpeg|webp)/);
  expect(poster.headers()['x-content-type-options']).toBe('nosniff');
  expect(poster.headers()['cache-control']).toBe('public, max-age=0, must-revalidate');
  expect((await poster.body()).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  const anonymousPut = await page.request.put('/api/admin/center-poster', { data: upload });
  expect([401, 403]).toContain(anonymousPut.status());
  const anonymousDelete = await page.request.delete('/api/admin/center-poster');
  expect([401, 403]).toContain(anonymousDelete.status());

  await signIn(page, 'candidate', '/apply');
  const userPut = await page.request.put('/api/admin/center-poster', { data: upload });
  expect(userPut.status()).toBe(403);
  const userDelete = await page.request.delete('/api/admin/center-poster');
  expect(userDelete.status()).toBe(403);
});

test('admin can replace the poster, see its catalog version, and restore the default', async ({ page }) => {
  const defaultResponse = await page.request.get('/api/center-poster');
  expect(defaultResponse.ok()).toBeTruthy();
  const defaultBytes = await defaultResponse.body();

  await signIn(page, 'admin', '/portal-admin/form-options');
  try {
    const replaced = await page.request.put('/api/admin/center-poster', { data: upload });
    expect(replaced.status(), await replaced.text()).toBe(200);
    const { version } = await replaced.json();
    expect(version).toBeTruthy();

    const malformed = await page.request.put('/api/admin/center-poster', {
      data: { mimeType: 'image/png', dataBase64: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64') },
    });
    expect(malformed.status()).toBe(400);
    const preserved = await page.request.get(`/api/center-poster?v=${encodeURIComponent(version)}`);
    expect(await preserved.body()).toEqual(testPng);

    const image = await page.request.get(`/api/center-poster?v=${encodeURIComponent(version)}`);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toMatch(/^image\/png/);
    expect(await image.body()).toEqual(testPng);

    const catalog = await page.request.get('/api/catalog');
    expect((await catalog.json()).centerPosterVersion).toBe(version);

    const reset = await page.request.delete('/api/admin/center-poster');
    expect(reset.status(), await reset.text()).toBe(200);
    expect(await reset.json()).toEqual({ version: null });

    const resetCatalog = await page.request.get('/api/catalog');
    expect((await resetCatalog.json()).centerPosterVersion).toBeNull();
    const resetImage = await page.request.get('/api/center-poster');
    expect(await resetImage.body()).toEqual(defaultBytes);
  } finally {
    await page.request.delete('/api/admin/center-poster');
  }
});

test('admin can manage the shared poster separately from center catalog saves', async ({ page }) => {
  await signIn(page, 'admin', '/portal-admin/form-options');
  const centers = page.locator('.admin-form-option-accordion').filter({ has: page.locator('summary', { hasText: 'ศูนย์สอบกลาง' }) });
  await centers.locator('summary').click();
  const settings = centers.locator('.center-poster-settings');
  await expect(settings).toBeVisible();
  await expect(settings.getByRole('img', { name: 'แผนที่ศูนย์สอบ Paper Based ทั่วประเทศไทย' })).toHaveAttribute('src', '/paper-based-centers-poster.png');

  let catalogWrites = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/admin/catalog') && request.method() === 'PUT') catalogWrites += 1;
  });
  await settings.locator('input[type="file"]').setInputFiles({ name: 'new-poster.png', mimeType: 'image/png', buffer: testPng });
  await expect(settings.getByRole('status')).toContainText('บันทึกโปสเตอร์แล้ว');
  await expect(settings.getByRole('img', { name: 'แผนที่ศูนย์สอบ Paper Based ทั่วประเทศไทย' })).toHaveAttribute('src', /\/api\/center-poster\?v=/);
  await expect.poll(() => catalogWrites).toBe(0);

  await page.evaluate(() => {
    window.history.pushState(null, '', '/apply');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  const firstCompetition = page.locator('.competition-card').first();
  await firstCompetition.locator('.competition-select input').check();
  await expect(page.locator('.center-poster-preview > div > img')).toHaveAttribute('src', /\/api\/center-poster\?v=/);
  await page.evaluate(() => {
    window.history.pushState(null, '', '/portal-admin/form-options');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('heading', { name: 'ข้อมูลตัวเลือกในฟอร์ม' })).toBeVisible();

  await page.reload();
  const reloadedCenters = page.locator('.admin-form-option-accordion').filter({ has: page.locator('summary', { hasText: 'ศูนย์สอบกลาง' }) });
  await reloadedCenters.locator('summary').click();
  const reloadedSettings = reloadedCenters.locator('.center-poster-settings');
  await expect(reloadedSettings.getByRole('img', { name: 'แผนที่ศูนย์สอบ Paper Based ทั่วประเทศไทย' })).toHaveAttribute('src', /\/api\/center-poster\?v=/);

  await reloadedSettings.locator('input[type="file"]').setInputFiles({ name: 'unsupported.gif', mimeType: 'image/gif', buffer: testPng });
  await expect(reloadedSettings.getByRole('alert')).toContainText('รองรับไฟล์ PNG, JPG หรือ WebP เท่านั้น');
  await reloadedSettings.locator('input[type="file"]').setInputFiles({ name: 'too-large.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(reloadedSettings.getByRole('alert')).toContainText('ไฟล์มีขนาดเกิน 5 MB');
  await expect(reloadedSettings.getByRole('img', { name: 'แผนที่ศูนย์สอบ Paper Based ทั่วประเทศไทย' })).toHaveAttribute('src', /\/api\/center-poster\?v=/);

  const reset = page.waitForResponse((response) => response.url().endsWith('/api/admin/center-poster') && response.request().method() === 'DELETE' && response.ok());
  await reloadedSettings.getByRole('button', { name: 'คืนรูปเริ่มต้น' }).click();
  await reset;
  await expect(reloadedSettings.getByRole('status')).toContainText('คืนรูปเริ่มต้นแล้ว');
  await expect(reloadedSettings.getByRole('img', { name: 'แผนที่ศูนย์สอบ Paper Based ทั่วประเทศไทย' })).toHaveAttribute('src', '/paper-based-centers-poster.png');
});

test('individual application shows one poster before selected Paper-Based center selectors', async ({ page }) => {
  await signIn(page, 'candidate', '/apply');
  const poster = page.locator('.center-poster-preview');
  await expect(poster).toHaveCount(0);

  const firstCard = page.locator('.competition-card').first();
  await firstCard.locator('.competition-select input').check();
  await expect(poster).toHaveCount(1);
  await expect(firstCard.locator('.competition-center-field')).toBeVisible();
  await expect(poster.getByRole('img', { name: 'แผนที่ศูนย์สอบ Paper Based ทั่วประเทศไทย' })).toBeVisible();
  await expect(poster.getByRole('img')).toHaveAttribute('src', '/paper-based-centers-poster.png');

  const posterPrecedesCenter = await page.evaluate(() => {
    const preview = document.querySelector('.center-poster-preview');
    const center = document.querySelector('.competition-center-field');
    return Boolean(preview && center && (preview.compareDocumentPosition(center) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(posterPrecedesCenter).toBe(true);

  await page.locator('.competition-card').nth(1).locator('.competition-select input').check();
  await expect(poster).toHaveCount(1);

  await poster.getByRole('button', { name: 'ดูโปสเตอร์ขนาดใหญ่' }).click();
  const viewer = page.getByRole('dialog', { name: 'โปสเตอร์ศูนย์สอบ Paper Based' });
  await expect(viewer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();

  for (const card of await page.locator('.competition-card-selected').all()) {
    await card.locator('input[type="radio"]').nth(1).check();
  }
  await expect(poster).toHaveCount(0);
});

test('school application poster follows the active applicant’s Paper-Based selections', async ({ page }) => {
  await signIn(page, 'candidate', '/apply');
  await page.locator('input[type="radio"][name="source"]').nth(1).click({ noWaitAfter: true });
  await expect(page.getByRole('heading', { name: 'สมัครสอบแบบโรงเรียน' })).toBeVisible();
  const poster = page.locator('.center-poster-preview');
  await expect(poster).toHaveCount(0);

  const firstCard = page.locator('.competition-card').first();
  await firstCard.locator('.competition-select input').check();
  await expect(poster).toHaveCount(1);

  await page.getByRole('button', { name: 'เพิ่มผู้เข้าสอบ' }).click();
  await expect(poster).toHaveCount(0);
  const activeCard = page.locator('.competition-card').first();
  await activeCard.locator('.competition-select input').check();
  await expect(poster).toHaveCount(1);
  await activeCard.locator('input[type="radio"]').nth(1).check();
  await expect(poster).toHaveCount(0);
});

test('mobile poster preview fits 390px and the full-size viewer works by keyboard and touch', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, 'candidate', '/apply');
  await page.locator('.competition-card').first().locator('.competition-select input').check();
  const preview = page.locator('.center-poster-preview');
  await expect(preview).toBeVisible();
  const dimensions = await page.evaluate(() => {
    const form = document.querySelector('.registration-form').getBoundingClientRect();
    const image = document.querySelector('.center-poster-preview > div > img').getBoundingClientRect();
    return { viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, formLeft: form.left, formRight: form.right, imageLeft: image.left, imageRight: image.right };
  });
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.imageLeft).toBeGreaterThanOrEqual(dimensions.formLeft);
  expect(dimensions.imageRight).toBeLessThanOrEqual(dimensions.formRight);

  const zoomButton = preview.getByRole('button', { name: 'ดูโปสเตอร์ขนาดใหญ่' });
  await zoomButton.focus();
  await page.keyboard.press('Enter');
  const viewer = page.getByRole('dialog', { name: 'โปสเตอร์ศูนย์สอบ Paper Based' });
  await expect(viewer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();

  const browser = page.context().browser();
  const touchContext = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const touchPage = await touchContext.newPage();
    await touchPage.goto('/api/auth/google/start?returnTo=%2Fapply&testPersona=candidate');
    await touchPage.locator('.competition-card').first().locator('.competition-select input').check();
    const touchButton = touchPage.locator('.center-poster-preview').getByRole('button', { name: 'ดูโปสเตอร์ขนาดใหญ่' });
    const buttonBox = await touchButton.boundingBox();
    expect(buttonBox).not.toBeNull();
    if (!buttonBox) throw new Error('Poster viewer button is not visible on mobile');
    await touchPage.touchscreen.tap(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2);
    await expect(touchPage.getByRole('dialog', { name: 'โปสเตอร์ศูนย์สอบ Paper Based' })).toBeVisible();
  } finally {
    await touchContext.close();
  }
});
