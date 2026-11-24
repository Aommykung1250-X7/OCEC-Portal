import { expect, test } from '@playwright/test';
import pg from 'pg';
import { closeFixtures, createReviewFixture } from './fixtures.js';

test.afterAll(closeFixtures);

test('admin opens slip, explicitly confirms inspection, and approves application end-to-end against real API and PostgreSQL', async ({ page }) => {
  const fixture = await createReviewFixture();
  await page.goto(`/api/auth/google/start?returnTo=${encodeURIComponent(`/portal-admin/applications/${fixture.id}`)}&testPersona=admin`);
  await expect(page).toHaveURL(new RegExp(`/portal-admin/applications/${fixture.id}`));
  await expect(page.locator('.review-detail')).toBeVisible();

  // 1) Slip preview loads automatically, but approval MUST remain disabled until explicit confirmation
  await expect(page.locator('.review-slip-image')).toBeVisible();
  const approveButton = page.getByRole('button', { name: 'อนุมัติใบสมัคร', exact: true });
  await expect(approveButton).toBeDisabled();

  // 2) Open enlarged slip dialog and confirm inspection through the real confirm-inspection API
  await page.getByRole('button', { name: `ขยายดูหลักฐานการชำระเงินของ ${fixture.name}` }).click();
  const slipDialog = page.getByRole('dialog', { name: `หลักฐานการชำระเงินโอนเงินของ ${fixture.name}` });
  await expect(slipDialog).toBeVisible();

  const [confirmResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes(`/api/admin/payment-slips/${fixture.slipId}/confirm-inspection`) && response.request().method() === 'POST'),
    slipDialog.getByRole('button', { name: 'ยืนยันว่าตรวจสลิปแล้ว' }).click(),
  ]);
  expect(confirmResponse.status()).toBe(200);
  await expect(slipDialog).not.toBeVisible();

  // 3) Confirmed badge is visible and approve button is now enabled
  await expect(page.locator('.review-slip-confirmed-badge')).toContainText(`ฉบับที่ v${fixture.slipVersion}`);
  await expect(approveButton).toBeEnabled();

  // 4) Click approve -> real PATCH /api/admin/applications/:id/review hits API and PostgreSQL
  const [approveResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes(`/api/admin/applications/${fixture.id}/review`) && response.request().method() === 'PATCH'),
    approveButton.click(),
  ]);
  expect(approveResponse.status()).toBe(200);
  const approveBody = await approveResponse.json();
  expect(approveBody.status).toBe('approved');
  expect(approveBody.slipId).toBe(fixture.slipId);
  expect(approveBody.slipVersion).toBe(fixture.slipVersion);
  await expect(page.locator('.toast')).toContainText('อนุมัติใบสมัครแล้ว');

  // 5) Verify real PostgreSQL state: application approved, payment confirmed, inspection confirmed, and audit records slip version & reviewer
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const appRow = (await db.query('SELECT status,approved_by FROM applications WHERE id=$1', [fixture.id])).rows[0];
    expect(appRow.status).toBe('approved');
    expect(appRow.approved_by).toBeTruthy();

    const payRow = (await db.query('SELECT status,confirmed_by FROM payments WHERE id=$1', [fixture.paymentId])).rows[0];
    expect(payRow.status).toBe('confirmed');
    expect(payRow.confirmed_by).toBe(appRow.approved_by);

    const inspectionRow = (await db.query(
      'SELECT slip_version,inspected_at,confirmed_at FROM payment_slip_inspections WHERE payment_slip_id=$1 AND inspector_user_id=$2',
      [fixture.slipId, appRow.approved_by],
    )).rows[0];
    expect(inspectionRow.slip_version).toBe(fixture.slipVersion);
    expect(inspectionRow.inspected_at).toBeTruthy();
    expect(inspectionRow.confirmed_at).toBeTruthy();

    const auditRow = (await db.query(
      "SELECT actor_user_id,after_data FROM audit_logs WHERE entity_type='application' AND entity_id=$1 AND action='approve' ORDER BY id DESC LIMIT 1",
      [fixture.id],
    )).rows[0];
    expect(auditRow.actor_user_id).toBe(appRow.approved_by);
    expect(auditRow.after_data.paymentId).toBe(fixture.paymentId);
    expect(auditRow.after_data.slipId).toBe(fixture.slipId);
    expect(auditRow.after_data.slipVersion).toBe(fixture.slipVersion);
    expect(auditRow.after_data.reviewerUserId).toBe(appRow.approved_by);
    expect(auditRow.after_data.confirmedAt).toBeTruthy();
  } finally {
    await db.end();
  }
});

test('admin must open PDF slip document viewer before confirming inspection and approving against real API and PostgreSQL', async ({ page }) => {
  const fixture = await createReviewFixture({ mimeType: 'application/pdf' });
  await page.goto(`/api/auth/google/start?returnTo=${encodeURIComponent(`/portal-admin/applications/${fixture.id}`)}&testPersona=admin`);
  await expect(page).toHaveURL(new RegExp(`/portal-admin/applications/${fixture.id}`));
  await expect(page.locator('.review-detail')).toBeVisible();

  // 1) Showing only the PDF icon card MUST NOT enable confirmation or approval, and MUST NOT record server inspection
  await expect(page.locator('.review-slip-pdf-card')).toBeVisible();
  const approveButton = page.getByRole('button', { name: 'อนุมัติใบสมัคร', exact: true });
  await expect(approveButton).toBeDisabled();
  await expect(page.getByRole('button', { name: 'ยืนยันว่าตรวจหลักฐานการชำระเงินแล้ว' })).toHaveCount(0);

  // Direct API attempts before opening PDF must fail with 409
  const prematureConfirm = await page.request.post(`/api/admin/payment-slips/${fixture.slipId}/confirm-inspection`, {
    data: { paymentId: fixture.paymentId, slipVersion: fixture.slipVersion },
  });
  expect(prematureConfirm.status()).toBe(409);
  const prematureApprove = await page.request.patch(`/api/admin/applications/${fixture.id}/review`, {
    data: { decision: 'approve', paymentId: fixture.paymentId, slipId: fixture.slipId, slipVersion: fixture.slipVersion },
  });
  expect(prematureApprove.status()).toBe(409);

  // 2) Open the PDF document viewer -> fetches real PDF from API, renders iframe, and enables confirmation inside the viewer
  const [pdfLoadResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes(`/api/admin/payment-slips/${fixture.slipId}`) && response.request().method() === 'GET'),
    page.getByRole('button', { name: 'เปิดดูไฟล์ PDF เพื่อยืนยันการตรวจ' }).click(),
  ]);
  expect(pdfLoadResponse.status()).toBe(200);
  expect(pdfLoadResponse.headers()['content-type']).toContain('application/pdf');

  const slipDialog = page.getByRole('dialog', { name: `หลักฐานการชำระเงินโอนเงินของ ${fixture.name}` });
  await expect(slipDialog).toBeVisible();
  await expect(slipDialog.locator('iframe.review-slip-dialog-pdf')).toBeVisible();

  const dialogConfirmButton = slipDialog.getByRole('button', { name: 'ยืนยันว่าตรวจสลิปแล้ว' });
  await expect(dialogConfirmButton).toBeEnabled();
  const [confirmResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes(`/api/admin/payment-slips/${fixture.slipId}/confirm-inspection`) && response.request().method() === 'POST'),
    dialogConfirmButton.click(),
  ]);
  expect(confirmResponse.status()).toBe(200);
  await expect(slipDialog).not.toBeVisible();

  // 3) Approve succeeds against real API and PostgreSQL
  await expect(page.locator('.review-slip-confirmed-badge')).toContainText(`ฉบับที่ v${fixture.slipVersion}`);
  await expect(approveButton).toBeEnabled();
  const [approveResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes(`/api/admin/applications/${fixture.id}/review`) && response.request().method() === 'PATCH'),
    approveButton.click(),
  ]);
  expect(approveResponse.status()).toBe(200);
  await expect(page.locator('.toast')).toContainText('อนุมัติใบสมัครแล้ว');

  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const appRow = (await db.query('SELECT status,approved_by FROM applications WHERE id=$1', [fixture.id])).rows[0];
    expect(appRow.status).toBe('approved');
    const inspectionRow = (await db.query(
      'SELECT slip_version,inspected_at,confirmed_at FROM payment_slip_inspections WHERE payment_slip_id=$1 AND inspector_user_id=$2',
      [fixture.slipId, appRow.approved_by],
    )).rows[0];
    expect(inspectionRow.slip_version).toBe(fixture.slipVersion);
    expect(inspectionRow.confirmed_at).toBeTruthy();
    const auditRow = (await db.query(
      "SELECT actor_user_id,after_data FROM audit_logs WHERE entity_type='application' AND entity_id=$1 AND action='approve' ORDER BY id DESC LIMIT 1",
      [fixture.id],
    )).rows[0];
    expect(auditRow.after_data.slipId).toBe(fixture.slipId);
    expect(auditRow.after_data.slipVersion).toBe(fixture.slipVersion);
    expect(auditRow.after_data.reviewerUserId).toBe(appRow.approved_by);
    expect(auditRow.after_data.confirmedAt).toBeTruthy();
  } finally {
    await db.end();
  }
});
