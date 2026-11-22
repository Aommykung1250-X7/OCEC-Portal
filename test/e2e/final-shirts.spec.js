import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { closeFixtures, createReviewFixture, makeHeatSelfOwned } from './fixtures.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const sizes = ['SS','S','M','L','XL','2XL','3XL','4XL','5XL'];
test.afterAll(closeFixtures);

async function signIn(page, persona, returnTo) {
  await page.goto(`/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}&testPersona=${persona}`);
  await expect(page).toHaveURL(new RegExp(`${returnTo}$`));
}
async function dbRun(run) {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try { return await run(db); } finally { await db.end(); }
}
async function fixtureFor(page, { multiple = false } = {}) {
  await signIn(page,'candidate','/applications');
  const fixture = await createReviewFixture();
  await makeHeatSelfOwned(fixture.id);
  await dbRun(async db => {
    await db.query("UPDATE applications SET status='approved' WHERE id=$1",[fixture.id]);
    for (const [index,competition] of (multiple ? ['bbb','hkiso'] : ['bbb']).entries()) {
      const round = `shirt-browser-${randomUUID()}`;
      await db.query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date)
        VALUES($1,$2,$2,'2569','FINAL',current_date-10,current_date-1)`,[round,competition]);
      if (index === 0) {
        fixture.roundId = round;
        await db.query("UPDATE application_items SET exam_round_id=$1,exam_number='SHIRT123' WHERE application_id=$2",[round,fixture.id]);
      } else {
        await db.query(`INSERT INTO application_items(application_id,exam_round_id,grade_id,format,center_id,fee_satang,snapshot,duplicate_key,exam_number)
          SELECT application_id,$1,grade_id,format,center_id,fee_satang,snapshot,$2,'SHIRT456' FROM application_items WHERE application_id=$3`,[round,randomUUID(),fixture.id]);
      }
    }
  });
  await page.goto(`/applications/${fixture.id}`);
  return fixture;
}

test('Final sizes save per exam beside certificate photos and survive reload without any images', async ({ page }) => {
  const fixture = await fixtureFor(page,{ multiple: true });
  const section = page.locator('.certificate-photo-section .final-shirt-section');
  await expect(section).toBeVisible();
  await expect(section.getByRole('img')).toHaveCount(0);
  const bbb = section.getByLabel('ไซซ์เสื้อ BBB', { exact: true });
  const hkiso = section.getByLabel('ไซซ์เสื้อ HKISO', { exact: true });
  await expect(bbb).toHaveValue('');
  expect(await bbb.locator('option').allTextContents()).toEqual(['เลือกไซซ์เสื้อ',...sizes]);
  await bbb.selectOption('SS');
  await hkiso.selectOption('5XL');
  await section.getByRole('button',{ name: 'บันทึกไซซ์เสื้อ',exact: true }).click();
  await expect(section.getByRole('status')).toHaveText('บันทึกไซซ์เสื้อแล้ว');
  await page.reload();
  await expect(bbb).toHaveValue('SS');
  await expect(hkiso).toHaveValue('5XL');
  await bbb.selectOption('M');
  await section.getByRole('button',{ name: 'บันทึกไซซ์เสื้อ',exact: true }).click();
  await expect(section.getByRole('status')).toHaveText('บันทึกไซซ์เสื้อแล้ว');
  await signIn(page,'admin',`/portal-admin/applications/${fixture.id}`);
  await expect(page.locator('.review-exam-row').filter({ hasText: 'BBB' })).toContainText('ไซซ์เสื้อ: M');
  await expect(page.locator('.review-exam-row').filter({ hasText: 'HKISO' })).toContainText('ไซซ์เสื้อ: 5XL');
});

test('HEAT omits shirts and retains its close/number gate; submitted Final and Final X can change sizes immediately', async ({page})=>{
  const fixture=await fixtureFor(page);
  await dbRun(db=>db.query("UPDATE exam_rounds SET round_type='HEAT',close_date=current_date+1 WHERE id=$1",[fixture.roundId]));
  await page.reload();
  await expect(page.locator('.final-shirt-section')).toHaveCount(0);
  await expect(page.locator('.certificate-photo-upload')).toHaveCount(0);
  for(const type of ['FINAL','FINAL_X']){
    await dbRun(async db=>{
      await db.query('UPDATE exam_rounds SET round_type=$1 WHERE id=$2',[type,fixture.roundId]);
      await db.query("UPDATE applications SET status='pending' WHERE id=$1",[fixture.id]);
      await db.query('UPDATE application_items SET exam_number=NULL WHERE application_id=$1',[fixture.id]);
    });
    await page.reload();
    await expect(page.locator('.final-shirt-section').getByLabel('ไซซ์เสื้อ BBB')).toBeEnabled();
    await expect(page.locator('.certificate-photo-upload')).toBeVisible();
  }
});

test('failed shirt writes show an error and can be retried without claiming success', async ({ page }) => {
  const fixture = await fixtureFor(page);
  const section = page.locator('.final-shirt-section');
  const url = `**/api/applications/${fixture.id}/shirt-sizes`;
  await page.route(url, route => route.fulfill({ status: 503,contentType: 'application/json',body: JSON.stringify({ error: 'ทดสอบการเชื่อมต่อขัดข้อง' }) }));
  await section.getByLabel('ไซซ์เสื้อ BBB').selectOption('XL');
  await section.getByRole('button',{ name: 'บันทึกไซซ์เสื้อ',exact: true }).click();
  await expect(section.getByRole('alert')).toContainText('ทดสอบการเชื่อมต่อขัดข้อง');
  await expect(section.getByRole('status')).toHaveCount(0);
  await page.reload();
  await expect(section.getByLabel('ไซซ์เสื้อ BBB')).toHaveValue('');
  await page.unroute(url);
  await section.getByLabel('ไซซ์เสื้อ BBB').selectOption('XL');
  await section.getByRole('button',{ name: 'บันทึกไซซ์เสื้อ',exact: true }).click();
  await expect(section.getByRole('status')).toHaveText('บันทึกไซซ์เสื้อแล้ว');
});

test('admin shirt images are optional, independently saved, replaceable and removable', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await signIn(page,'admin','/portal-admin/form-options');
  const accordion = page.locator('.admin-form-option-accordion').filter({ has: page.locator('summary',{ hasText: 'เสื้อรอบ Final' }) });
  await accordion.locator('summary').click();
  const settings = page.locator('.final-shirt-settings');
  let catalogWrites = 0;
  page.on('request', request => { if (request.url().endsWith('/api/admin/catalog') && request.method() === 'PUT') catalogWrites += 1; });
  try {
    for (const label of ['ตารางไซซ์เสื้อ','ตัวอย่างเสื้อ']) {
      await settings.getByLabel(`อัปโหลด${label}`,{ exact: true }).setInputFiles({ name: 'shirt.png',mimeType: 'image/png',buffer: png });
      await expect(settings.getByRole('img',{ name: label,exact: true })).toBeVisible();
    }
    await expect(settings.getByRole('status')).toContainText('บันทึกตัวอย่างเสื้อแล้ว');
    await page.reload();
    await accordion.locator('summary').click();
    await expect(settings.getByRole('img')).toHaveCount(2);
    await settings.getByLabel('อัปโหลดตารางไซซ์เสื้อ',{ exact: true }).setInputFiles({ name: 'wrong.gif',mimeType: 'image/gif',buffer: png });
    await expect(settings.getByRole('alert')).toContainText('รองรับไฟล์ PNG, JPG และ WebP เท่านั้น');
    await settings.getByLabel('อัปโหลดตารางไซซ์เสื้อ',{ exact: true }).setInputFiles({ name: 'big.png',mimeType: 'image/png',buffer: Buffer.alloc(5*1024*1024+1) });
    await expect(settings.getByRole('alert')).toContainText('ขนาดไฟล์ต้องไม่เกิน 5 MB');
    await expect(settings.getByRole('img')).toHaveCount(2);
    expect(catalogWrites).toBe(0);
    await page.setViewportSize({ width: 320,height: 900 });
    await settings.scrollIntoViewIfNeeded();
    await settings.screenshot({ path: 'outputs/final-shirts/admin-mobile.png' });

    await fixtureFor(page);
    const section = page.locator('.final-shirt-section');
    await expect(section.getByRole('img')).toHaveCount(2);
    await section.getByRole('button',{ name: 'ขยายตารางไซซ์เสื้อ',exact: true }).click();
    await expect(page.getByRole('dialog',{ name: 'ภาพเสื้อรอบ Final' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog',{ name: 'ภาพเสื้อรอบ Final' })).toBeHidden();
    for (const width of [320,768,1024,1440]) {
      await page.setViewportSize({ width,height: 1000 });
      await page.evaluate(() => document.fonts.ready);
      await section.scrollIntoViewIfNeeded();
      const bounds = await section.evaluate(element => ({ left: element.getBoundingClientRect().left,right: element.getBoundingClientRect().right,scrollWidth: element.scrollWidth,clientWidth: element.clientWidth }));
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(width);
      expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth);
      expect(await section.getByRole('img').first().evaluate(image => image.getBoundingClientRect().height)).toBeLessThanOrEqual(160);
      if (width === 320 || width === 1440) await section.screenshot({ path: `outputs/final-shirts/applicant-${width}.png` });
    }
    expect(errors).toEqual([]);
    await signIn(page,'admin','/portal-admin/form-options');
    await accordion.locator('summary').click();
    for (const label of ['ตารางไซซ์เสื้อ','ตัวอย่างเสื้อ']) {
      await settings.getByRole('button',{ name: `ลบ${label}`,exact: true }).click();
      await expect(settings.getByRole('img',{ name: label,exact: true })).toHaveCount(0);
    }
  } finally {
    await signIn(page,'admin','/portal-admin/form-options');
    for (const kind of ['chart','sample']) await page.request.delete(`/api/admin/final-shirt-images/${kind}`);
  }
});
