import { expect, test } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { getPool } from '../../server/db.js';
import { migrate } from '../../server/migrate.js';
import { seed } from '../../server/seed.js';

async function createAdminSessionCookie(browser, baseURL) {
  const email = 'admin@ocec.test';
  const user = (await getPool().query(
    `INSERT INTO users(google_sub,email,display_name,is_admin)
     VALUES('ocec-test-admin',$1,'Test Admin',true)
     ON CONFLICT (google_sub) DO UPDATE SET email=excluded.email,is_admin=true
     RETURNING id`,
    [email],
  )).rows[0];
  const token = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
  await getPool().query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')", [
    createHash('sha256').update(token).digest('hex'),
    user.id,
  ]);
  const origin = new URL(baseURL);
  const context = await browser.newContext();
  await context.addCookies([{ name: 'ocec_session', value: token, domain: origin.hostname, path: '/', httpOnly: true, sameSite: 'Lax' }]);
  return { context, cookieHeader: `ocec_session=${token}` };
}

test('two admin sessions: stale browser save shows conflict alert with reload and preserves the other admin payment account change', async ({ browser, baseURL }) => {
  await migrate({ silent: true });
  await seed();

  const sessionA = await createAdminSessionCookie(browser, baseURL);
  const sessionB = await createAdminSessionCookie(browser, baseURL);
  try {
    const pageB = await sessionB.context.newPage();
    await pageB.goto('/portal-admin/form-options');
    await expect(pageB.getByRole('heading', { name: 'ข้อมูลตัวเลือกในแบบฟอร์ม' })).toBeVisible();

    // Admin A updates payment accounts via API (simulating another admin saving first)
    const currentCatalogRes = await sessionA.context.request.get('/api/catalog');
    const currentCatalog = await currentCatalogRes.json();
    const initialEtag = currentCatalogRes.headers()['etag'];
    const freshAccountNumber = `888-0-${String(Date.now()).slice(-5)}-1`;
    const freshAccountId = `e2e-acct-${Date.now()}`;
    const saveA = await sessionA.context.request.put('/api/admin/payment-accounts', {
      headers: { 'if-match': initialEtag },
      data: {
        expectedRevision: currentCatalog.revision,
        paymentAccounts: [
          ...currentCatalog.paymentAccounts.map((acc) => ({ ...acc, showInForm: false })),
          { id: freshAccountId, bankName: 'KBank', accountName: 'OCEC Session A Account', accountNumber: freshAccountNumber, category: 'president', showInForm: true, active: true },
        ],
      },
    });
    expect(saveA.status()).toBe(200);

    // Admin B (who opened the page BEFORE Admin A saved) opens ศูนย์สอบกลาง and adds a center from stale state
    await pageB.getByText('ศูนย์สอบกลาง').click();
    await pageB.getByLabel('รหัสศูนย์สอบใหม่').fill('772');
    await pageB.getByLabel('ชื่อศูนย์สอบใหม่').fill('ศูนย์สอบจากแท็บเก่า');
    await pageB.getByRole('button', { name: 'เพิ่มศูนย์' }).click();

    // Auto-save fires with stale If-Match -> UI displays conflict alert & reload button
    const conflictAlert = pageB.getByRole('alert').filter({ hasText: 'โหลดข้อมูลล่าสุด' });
    await expect(conflictAlert).toBeVisible({ timeout: 10000 });
    await expect(pageB.getByRole('button', { name: 'โหลดข้อมูลล่าสุด' })).toBeVisible();

    // Verify Admin A's payment account was NOT overwritten in PostgreSQL
    const afterConflict = await (await sessionA.context.request.get('/api/catalog')).json();
    expect(afterConflict.paymentAccounts.some((acc) => acc.id === freshAccountId && acc.showInForm === true)).toBe(true);
    expect(afterConflict.centers.some((center) => center.code === '772')).toBe(false);

    // Admin B clicks โหลดข้อมูลล่าสุด -> fresh catalog loads including Admin A's payment account
    await pageB.getByRole('button', { name: 'โหลดข้อมูลล่าสุด' }).click();
    await expect(conflictAlert).toHaveCount(0);
    await pageB.getByText('บัญชีรับชำระเงิน').click();
    await expect(pageB.locator(`input[value="${freshAccountNumber}"]`)).toBeVisible();
  } finally {
    await sessionA.context.close();
    await sessionB.context.close();
  }
});
