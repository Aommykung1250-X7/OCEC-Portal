import { expect, test } from '@playwright/test';

async function catalogPage(page) {
  await page.goto(`/api/auth/google/start?returnTo=${encodeURIComponent('/portal-admin/form-options')}&testPersona=admin`);
  await expect(page).toHaveURL(/\/portal-admin\/form-options/);
  await page.locator('.admin-form-option-accordion').filter({ has: page.locator('summary', { hasText: 'ระดับชั้น' }) }).locator('summary').click();
}

async function roundsPage(page) {
  await page.goto(`/api/auth/google/start?returnTo=${encodeURIComponent('/portal-admin/exams')}&testPersona=admin`);
  await expect(page).toHaveURL(/\/portal-admin\/exams/);
  await expect(page.locator('.admin-round-catalog')).toBeVisible();
}

async function formOptionsPage(page) {
  await page.goto(`/api/auth/google/start?returnTo=${encodeURIComponent('/portal-admin/form-options')}&testPersona=admin`);
  await expect(page).toHaveURL(/\/portal-admin\/form-options/);
  await expect(page.locator('.admin-form-options-accordions')).toBeVisible();
}

test('center catalog changes save and remain available after reload', async ({ page }) => {
  await formOptionsPage(page);
  const centers = page.locator('.admin-form-option-accordion').filter({ has: page.locator('summary', { hasText: 'ศูนย์สอบกลาง' }) });
  await centers.locator('summary').click();
  await centers.getByLabel('รหัสศูนย์สอบใหม่').fill('998');
  await centers.getByLabel('ชื่อศูนย์สอบใหม่').fill('Browser Test Center');
  const saved = page.waitForResponse((response) => response.url().endsWith('/api/admin/catalog') && response.request().method() === 'PUT' && response.ok());
  await centers.getByRole('button', { name: 'เพิ่มศูนย์' }).click();
  await saved;
  await expect(centers.getByRole('textbox', { name: 'รหัสศูนย์สอบ Browser Test Center' })).toHaveValue('998');
  await page.reload();
  await centers.locator('summary').click();
  await expect(centers.getByRole('textbox', { name: 'รหัสศูนย์สอบ Browser Test Center' })).toHaveValue('998');
});

test('payment account selection saves only the chosen account and survives reload', async ({ page }) => {
  await formOptionsPage(page);
  const accounts = page.locator('.admin-form-option-accordion').filter({ has: page.locator('summary', { hasText: 'บัญชีรับโอน' }) });
  await accounts.locator('summary').click();
  const form = accounts.locator('form.admin-add-payment-account');
  await form.getByRole('textbox', { name: 'ธนาคาร' }).fill('Browser Bank');
  await form.getByRole('textbox', { name: 'ชื่อบัญชี' }).fill('Portal Test Account');
  await form.getByRole('textbox', { name: 'เลขบัญชี' }).fill('888-12-3456');
  const saved = page.waitForResponse((response) => response.url().endsWith('/api/admin/catalog') && response.request().method() === 'PUT' && response.ok());
  await form.getByRole('button', { name: 'เพิ่มบัญชี' }).click();
  await saved;
  let selections = accounts.getByRole('radio', { name: 'แสดงในฟอร์มสมัคร' });
  await expect(selections).toHaveCount(2);
  await expect(selections.nth(0)).not.toBeChecked();
  await expect(selections.nth(1)).toBeChecked();
  await page.reload();
  await accounts.locator('summary').click();
  selections = accounts.getByRole('radio', { name: 'แสดงในฟอร์มสมัคร' });
  await expect(selections).toHaveCount(2);
  await expect(selections.nth(0)).not.toBeChecked();
  await expect(selections.nth(1)).toBeChecked();
});

test('competition choice edits save to the catalog and load into the round form', async ({ page }) => {
  await roundsPage(page);
  await page.getByRole('button', { name: 'เพิ่มรายการสอบ' }).click();
  let form = page.locator('.admin-exam-create-form');
  await form.getByLabel('ชื่อรายการสอบ').selectOption('timo');
  await form.getByRole('button', { name: 'เพิ่ม/แก้ชื่อ' }).click();
  let competitionManager = form.locator('.admin-competition-manager');
  const saved = page.waitForResponse((response) => response.url().endsWith('/api/admin/catalog') && response.request().method() === 'PUT' && response.ok());
  await competitionManager.getByRole('textbox', { name: 'ชื่อใน dropdown' }).fill('TIMO-QA');
  await saved;
  await expect(competitionManager.getByRole('textbox', { name: 'ชื่อใน dropdown' })).toHaveValue('TIMO-QA');

  await page.reload();
  await page.getByRole('button', { name: 'เพิ่มรายการสอบ' }).click();
  form = page.locator('.admin-exam-create-form');
  await form.getByLabel('ชื่อรายการสอบ').selectOption('timo');
  await form.getByRole('button', { name: 'เพิ่ม/แก้ชื่อ' }).click();
  competitionManager = form.locator('.admin-competition-manager');
  await expect(competitionManager.getByRole('textbox', { name: 'ชื่อใน dropdown' })).toHaveValue('TIMO-QA');
});

test('round edit keeps dirty changes after a failed save and persists on retry', async ({ page }) => {
  await roundsPage(page);
  let round = page.locator('.admin-round-accordion').filter({ hasText: 'HKICO HEAT ROUND 2569' });
  await round.locator('summary').click();
  const price = round.locator('.admin-round-price-edit input').first();
  await price.fill('899');
  await expect(round).toContainText('มีการเปลี่ยนแปลงในรอบนี้');

  await page.route('**/api/admin/exams/hkico-heat-2569', async (route) => {
    if (route.request().method() === 'PATCH') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'round save blocked by test' }) });
    return route.continue();
  });
  await round.getByRole('button', { name: 'บันทึกรอบนี้' }).click();
  await expect(page.getByRole('alert')).toContainText('round save blocked by test');
  await expect(round).toContainText('มีการเปลี่ยนแปลงในรอบนี้');
  await page.unroute('**/api/admin/exams/hkico-heat-2569');

  const saved = page.waitForResponse((response) => response.url().endsWith('/api/admin/exams/hkico-heat-2569') && response.request().method() === 'PATCH' && response.ok());
  await round.getByRole('button', { name: 'บันทึกรอบนี้' }).click();
  await saved;
  await expect(round).toContainText('ข้อมูลรอบนี้บันทึกแล้ว');
  await page.reload();
  round = page.locator('.admin-round-accordion').filter({ hasText: 'HKICO HEAT ROUND 2569' });
  await round.locator('summary').click();
  await expect(round.locator('.admin-round-price-edit input').first()).toHaveValue('899');
});

test('admin can add an exam round and close an open round with confirmation', async ({ page }) => {
  await roundsPage(page);
  await page.getByRole('button', { name: 'เพิ่มรายการสอบ' }).click();
  const form = page.locator('.admin-exam-create-form');
  await form.getByLabel('ชื่อรายการสอบ').selectOption('timo');
  await form.getByRole('checkbox', { name: 'HEAT ROUND' }).check();
  await form.getByRole('textbox', { name: /ปีการศึกษา/ }).fill('2570');
  await form.locator('.admin-grade-selection').getByRole('checkbox', { name: 'Primary 1' }).check();
  const saved = page.waitForResponse((response) => response.url().endsWith('/api/admin/catalog') && response.request().method() === 'PUT' && response.ok());
  await form.getByRole('button', { name: 'เพิ่ม 1 การ์ด' }).click();
  await saved;
  const newRound = page.locator('.admin-round-accordion').filter({ hasText: 'TIMO HEAT ROUND 2570' });
  await expect(newRound).toHaveCount(1);

  await page.getByLabel('ปีการศึกษา').selectOption('2569');
  const existingRound = page.locator('.admin-round-accordion').filter({ hasText: 'Big Bay Bei (BBB) HEAT ROUND 2569' });
  await existingRound.locator('summary').click();
  await existingRound.getByRole('button', { name: 'ปิดรับ', exact: true }).click();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation).toContainText('ปิดรับสมัครรายการนี้?');
  const closed = page.waitForResponse((response) => response.url().endsWith('/api/admin/exams/bbb-heat-2569') && response.request().method() === 'PATCH' && response.ok());
  await confirmation.getByRole('button', { name: 'ยืนยันปิดรับ' }).click();
  await closed;
  await expect(existingRound).toContainText('ปิดโดยแอดมิน');
});

test('catalog dirty state survives failed automatic save and blocks accidental navigation', async ({ page }) => {
  await catalogPage(page);
  await page.route('**/api/admin/catalog', async (route) => {
    if (route.request().method() === 'PUT') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'save blocked by test' }) });
    return route.continue();
  });
  await page.locator('#new-grade-option').fill('Browser Test Grade');
  await page.getByRole('button', { name: 'เพิ่มระดับชั้น' }).click();
  await expect(page.getByRole('alert')).toContainText('save blocked by test');
  await page.locator('.sidebar a[href="#admin-review"]').click();
  const confirmation = page.getByRole('dialog', { name: 'ออกจากหน้านี้?' });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'ยกเลิก' }).click();
  await expect(page).toHaveURL(/\/portal-admin\/form-options/);
  await expect(page.locator('.admin-grade-catalog-list')).toContainText('Browser Test Grade');
  await page.locator('.sidebar a[href="#admin-review"]').click();
  await confirmation.getByRole('button', { name: 'ออกจากหน้า' }).click();
  await expect(page).toHaveURL(/\/portal-admin\/review/);
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

test('past paper sale toggle is a button and deletion stays deleted after reload', async ({ page }) => {
  await page.goto(`/api/auth/google/start?returnTo=${encodeURIComponent('/portal-admin/form-options')}&testPersona=admin`);
  const papers = page.locator('.admin-form-option-accordion').filter({ has: page.locator('summary', { hasText: 'ข้อสอบเก่าและราคา' }) });
  await papers.locator('summary').click();

  const name = `Browser Delete Paper ${Date.now()}`;
  await papers.getByRole('textbox', { name: 'ชื่อรายการข้อสอบเก่าใหม่' }).fill(name);
  let saved = page.waitForResponse((response) => response.url().endsWith('/api/admin/catalog') && response.request().method() === 'PUT' && response.ok());
  await papers.getByRole('button', { name: 'เพิ่มข้อสอบเก่า' }).click();
  await saved;

  const row = papers.locator('tbody tr').filter({ hasText: name });
  const closeButton = row.getByRole('button', { name: `ปิดขายข้อสอบเก่า ${name}` });
  await expect(closeButton).toHaveClass(/admin-paper-toggle-close/);
  saved = page.waitForResponse((response) => response.url().endsWith('/api/admin/catalog') && response.request().method() === 'PUT' && response.ok());
  await closeButton.click();
  await saved;
  await expect(row.getByRole('button', { name: `เปิดขายข้อสอบเก่า ${name}` })).toHaveClass(/admin-paper-toggle-open/);

  saved = page.waitForResponse((response) => response.url().endsWith('/api/admin/catalog') && response.request().method() === 'PUT' && response.ok());
  await row.getByRole('button', { name: `ลบข้อสอบเก่า ${name}` }).click();
  await page.getByRole('dialog', { name: 'ลบข้อสอบเก่า?' }).getByRole('button', { name: 'ลบข้อสอบเก่า' }).click();
  await saved;
  await expect(row).toHaveCount(0);

  await page.reload();
  await papers.locator('summary').click();
  await expect(papers.locator('tbody tr').filter({ hasText: name })).toHaveCount(0);
});

test('catalog panels keep actions in bounds on mobile and desktop', async ({ page }) => {
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await formOptionsPage(page);
    const expectNoHorizontalPageOverflow = async () => {
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      }));
      expect(dimensions.content, `page overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport + 1);
    };
    await expectNoHorizontalPageOverflow();

    const openPanel = async (title) => {
      const panel = page.locator('.admin-form-option-accordion').filter({ has: page.locator('summary', { hasText: title }) });
      if (!(await panel.evaluate((element) => element.open))) await panel.locator('summary').click();
      await expect(panel.locator('.admin-form-option-panel')).toBeVisible();
      const bounds = await panel.locator('.admin-form-option-panel').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      });
      expect(bounds.left, `${title} left edge at ${width}px`).toBeGreaterThanOrEqual(-1);
      expect(bounds.right, `${title} right edge at ${width}px`).toBeLessThanOrEqual(width + 1);
      await expectNoHorizontalPageOverflow();
      return panel;
    };

    const accounts = await openPanel('บัญชีรับโอน');
    await expect(accounts.getByRole('button', { name: 'เพิ่มบัญชี' })).toBeVisible();
    await expect(accounts.getByRole('textbox', { name: 'ธนาคาร' }).last()).toBeVisible();
    const papers = await openPanel('ข้อสอบเก่าและราคา');
    await expect(papers.getByRole('button', { name: 'เพิ่มข้อสอบเก่า' })).toBeVisible();
    await expect(papers.locator('.admin-paper-table-wrap')).toBeVisible();
    const grades = await openPanel('ระดับชั้น');
    await expect(grades.getByRole('button', { name: 'เพิ่มระดับชั้น' })).toBeVisible();
    const centers = await openPanel('ศูนย์สอบกลาง');
    await expect(centers.getByRole('button', { name: 'เพิ่มศูนย์' })).toBeVisible();
    await expect(centers.getByLabel('ชื่อศูนย์สอบใหม่')).toBeVisible();
    const centerGeometry = await centers.locator('.center-row-editable').first().evaluate((row) => {
      const rowBounds = row.getBoundingClientRect();
      const tableBounds = row.closest('.centers-table').getBoundingClientRect();
      const actionBounds = row.querySelector('.center-row-actions').getBoundingClientRect();
      return { rowBottom: rowBounds.bottom, tableLeft: tableBounds.left, tableRight: tableBounds.right, actionLeft: actionBounds.left, actionRight: actionBounds.right, actionBottom: actionBounds.bottom };
    });
    expect(centerGeometry.actionLeft, `center actions left edge at ${width}px`).toBeGreaterThanOrEqual(centerGeometry.tableLeft - 1);
    expect(centerGeometry.actionRight, `center actions right edge at ${width}px`).toBeLessThanOrEqual(centerGeometry.tableRight + 1);
    expect(centerGeometry.actionBottom, `center actions fit row at ${width}px`).toBeLessThanOrEqual(centerGeometry.rowBottom + 1);

    if (width === 320 || width === 390 || width === 1280) {
      await page.screenshot({ path: `/private/tmp/ocec-admin-catalog-${width}.png`, fullPage: true });
    }
  }
});

test('round creation and editing remain usable at mobile widths', async ({ page }) => {
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await roundsPage(page);
    const expectNoHorizontalPageOverflow = async () => {
      const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
      expect(dimensions.content, `round page overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport + 1);
    };
    await expectNoHorizontalPageOverflow();

    await page.getByRole('button', { name: 'เพิ่มรายการสอบ' }).click();
    const form = page.locator('.admin-exam-create-form');
    await expect(form).toBeVisible();
    await form.getByLabel('ชื่อรายการสอบ').selectOption('timo');
    await form.getByRole('checkbox', { name: 'HEAT ROUND' }).check();
    await expect(form.locator('.admin-round-price-set')).toBeVisible();
    const createActionBounds = await form.locator('.admin-exam-form-footer > div').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const formRect = element.closest('form').getBoundingClientRect();
      return { left: rect.left, right: rect.right, formLeft: formRect.left, formRight: formRect.right };
    });
    expect(createActionBounds.left).toBeGreaterThanOrEqual(createActionBounds.formLeft - 1);
    expect(createActionBounds.right).toBeLessThanOrEqual(createActionBounds.formRight + 1);
    await expect(form.getByRole('button', { name: 'เพิ่ม 1 การ์ด' })).toBeVisible();
    await expectNoHorizontalPageOverflow();

    if (width === 320 || width === 390 || width === 1280) {
      await page.screenshot({ path: `/private/tmp/ocec-admin-round-create-${width}.png`, fullPage: true });
    }
    await form.getByRole('button', { name: 'ยกเลิก' }).click();

    const round = page.locator('.admin-round-accordion').first();
    await round.locator('summary').click();
    const saveButton = round.getByRole('button', { name: 'บันทึกรอบนี้' });
    await saveButton.scrollIntoViewIfNeeded();
    await expect(saveButton).toBeVisible();
    if (width === 320 || width === 390 || width === 1280) {
      await page.screenshot({ path: `/private/tmp/ocec-admin-round-edit-${width}.png`, fullPage: true });
    }
    const roundBounds = await round.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    });
    expect(roundBounds.left, `round left edge at ${width}px`).toBeGreaterThanOrEqual(-1);
    expect(roundBounds.right, `round right edge at ${width}px`).toBeLessThanOrEqual(width + 1);
    await expectNoHorizontalPageOverflow();
  }
});
