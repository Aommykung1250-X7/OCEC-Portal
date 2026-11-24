import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { app } from '../server/index.js';
import { getPool } from '../server/db.js';
import { seed } from '../server/seed.js';
import { decryptQueuedEmailText } from '../server/integrationQueue.js';
import { replacePaymentSlip, reviewApplication, submitIndividualApplication, submitSchoolBatch, updateAdminApplication } from '../server/applications.js';
import { installMockGoogleWorkspace } from './e2e/google-workspace-mock.js';

const testUrl = process.env.TEST_DATABASE_URL;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const slipPayload = (name = 'slip.png') => ({ fileName: name, mimeType: 'image/png', dataBase64: png.toString('base64') });

if (!testUrl) {
  test('OCEC-03 payment slip approval binding requires a disposable local PostgreSQL database', { skip: 'Use npm run test:db' }, () => {});
} else {
  const parsed = new URL(testUrl);
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) || !parsed.pathname.toLowerCase().includes('test') || process.env.DATABASE_URL !== testUrl) {
    throw new Error('Use a disposable local test database');
  }
  app.log.level = 'silent';

  const suffix = randomUUID().slice(0, 8);
  let ownerId;
  let adminAId;
  let adminBId;
  let adminACookie;
  let adminBCookie;
  let gradeId;
  let centerId;
  let previousAdmins;
  let previousDriveTimeout;
  let originalFetch;

  async function sessionFor(userId) {
    const token = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
    await getPool().query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')", [createHash('sha256').update(token).digest('hex'), userId]);
    return `ocec_session=${token}`;
  }

  function applicantInput(tag) {
    return {
      firstNameEn: `Slip${suffix}${tag}`,
      lastNameEn: 'Tester',
      dateOfBirth: '2017-01-01',
      schoolName: `Slip School ${suffix}`,
      contactEmail: `slip-${tag.toLowerCase()}-${suffix}@example.test`,
      contactPhone: '0812345678',
    };
  }

  async function confirmInspection(slipId, paymentId, slipVersion, cookie) {
    return app.inject({
      method: 'POST',
      url: `/api/admin/payment-slips/${slipId}/confirm-inspection`,
      headers: { cookie },
      payload: { paymentId, slipVersion },
    });
  }

  test.before(async () => {
    await seed();
    previousAdmins = process.env.ADMIN_EMAILS;
    previousDriveTimeout = process.env.GOOGLE_DRIVE_TIMEOUT_MS;
    originalFetch = globalThis.fetch;
    const users = await getPool().query(`INSERT INTO users(google_sub,email,display_name,is_admin) VALUES
      ($1,$2,'Slip Owner',false),
      ($3,$4,'Slip Admin A',true),
      ($5,$6,'Slip Admin B',true)
      RETURNING id,email`, [
      `slip-owner-${suffix}`, `slip-owner-${suffix}@example.test`,
      `slip-admin-a-${suffix}`, `slip-admin-a-${suffix}@example.test`,
      `slip-admin-b-${suffix}`, `slip-admin-b-${suffix}@example.test`,
    ]);
    [ownerId, adminAId, adminBId] = users.rows.map((row) => row.id);
    process.env.ADMIN_EMAILS = `${users.rows[1].email},${users.rows[2].email}`;
    [adminACookie, adminBCookie] = await Promise.all([adminAId, adminBId].map(sessionFor));
    gradeId = (await getPool().query("SELECT id FROM grade_catalog WHERE label='Primary 1'")).rows[0].id;
    centerId = (await getPool().query("SELECT id FROM exam_centers WHERE code='554'")).rows[0].id;
    await getPool().query("UPDATE exam_rounds SET open_date=current_date-1,close_date=current_date+1,active=true,final_manually_closed=false WHERE id='bbb-heat-2569'");
    await installMockGoogleWorkspace();
  });

  test.after(async () => {
    globalThis.fetch = originalFetch;
    await getPool().query("DELETE FROM google_workspace_connection WHERE account_email='workspace@ocec.test'");
    if (previousAdmins === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = previousAdmins;
    if (previousDriveTimeout === undefined) delete process.env.GOOGLE_DRIVE_TIMEOUT_MS; else process.env.GOOGLE_DRIVE_TIMEOUT_MS = previousDriveTimeout;
    await app.close();
    await getPool().end();
  });

  test('rejects approval when slip is only preview-loaded, missing after preview, timed out in Drive, replaced mid-review, or repeated', async () => {
    const submitted = await submitIndividualApplication({
      applicant: applicantInput('Main'),
      items: [{ roundId: 'bbb-heat-2569', gradeId, format: 'paper', centerId }],
      pastPaperIds: [],
      source: 'self',
      slip: slipPayload('v1.png'),
    }, ownerId);
    const v1 = (await getPool().query('SELECT id,payment_id,version,drive_file_id FROM payment_slips WHERE payment_id=$1 ORDER BY version DESC LIMIT 1', [submitted.paymentId])).rows[0];

    // 1) Missing slip binding fields or confirming before preview load -> 409
    assert.equal((await app.inject({
      method: 'PATCH',
      url: `/api/admin/applications/${submitted.id}/review`,
      headers: { cookie: adminACookie },
      payload: { decision: 'approve', paymentId: submitted.paymentId },
    })).statusCode, 409);

    assert.equal((await confirmInspection(v1.id, submitted.paymentId, v1.version, adminACookie)).statusCode, 409);

    // 2) Auto-loading preview alone (GET) is NOT confirmation -> approval must still fail (409)
    const viewV1 = await app.inject({ method: 'GET', url: `/api/admin/payment-slips/${v1.id}`, headers: { cookie: adminACookie } });
    assert.equal(viewV1.statusCode, 200);
    assert.equal(viewV1.headers['x-payment-slip-id'], v1.id);
    assert.equal(viewV1.headers['x-payment-slip-version'], '1');

    const previewOnlyApprove = await app.inject({
      method: 'PATCH',
      url: `/api/admin/applications/${submitted.id}/review`,
      headers: { cookie: adminACookie },
      payload: { decision: 'approve', paymentId: submitted.paymentId, slipId: v1.id, slipVersion: v1.version },
    });
    assert.equal(previewOnlyApprove.statusCode, 409, 'auto-loading preview must not authorize approval without explicit confirmation');

    // 3) Admin A explicitly confirms inspection of v1
    const confirmV1 = await confirmInspection(v1.id, submitted.paymentId, v1.version, adminACookie);
    assert.equal(confirmV1.statusCode, 200, confirmV1.body);
    assert.equal(confirmV1.json().confirmed, true);

    // 4) Admin B (different account) cannot approve using Admin A's confirmation -> 409
    assert.equal((await app.inject({
      method: 'PATCH',
      url: `/api/admin/applications/${submitted.id}/review`,
      headers: { cookie: adminBCookie },
      payload: { decision: 'approve', paymentId: submitted.paymentId, slipId: v1.id, slipVersion: v1.version },
    })).statusCode, 409);

    // 5) File disappears from Google Drive AFTER Admin A opened and confirmed -> approval must fail (409)
    const mockFetch = globalThis.fetch;
    globalThis.fetch = async (url, options = {}) => {
      if (String(url).includes(`/drive/v3/files/${v1.drive_file_id}`)) return new Response(null, { status: 404 });
      return mockFetch(url, options);
    };
    try {
      const missingAfterOpen = await app.inject({
        method: 'PATCH',
        url: `/api/admin/applications/${submitted.id}/review`,
        headers: { cookie: adminACookie },
        payload: { decision: 'approve', paymentId: submitted.paymentId, slipId: v1.id, slipVersion: v1.version },
      });
      assert.equal(missingAfterOpen.statusCode, 409, missingAfterOpen.body);
      assert.equal((await getPool().query('SELECT status FROM applications WHERE id=$1', [submitted.id])).rows[0].status, 'pending');
    } finally {
      globalThis.fetch = mockFetch;
    }

    // 6) Drive hangs past deadline -> aborts with 504 without holding DB row locks
    process.env.GOOGLE_DRIVE_TIMEOUT_MS = '80';
    let driveStarted;
    const driveWait = new Promise((resolve) => { driveStarted = resolve; });
    globalThis.fetch = async (url, options = {}) => {
      if (String(url).includes(`/drive/v3/files/${v1.drive_file_id}`)) {
        driveStarted();
        return new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })), { once: true });
        });
      }
      return mockFetch(url, options);
    };
    try {
      const slowApprovePromise = app.inject({
        method: 'PATCH',
        url: `/api/admin/applications/${submitted.id}/review`,
        headers: { cookie: adminACookie },
        payload: { decision: 'approve', paymentId: submitted.paymentId, slipId: v1.id, slipVersion: v1.version },
      });
      await driveWait;
      // Row lock check: SELECT ... FOR UPDATE NOWAIT must succeed immediately while Drive is waiting!
      const lockCheck = await getPool().query('SELECT id FROM applications WHERE id=$1 FOR UPDATE NOWAIT', [submitted.id]);
      assert.equal(lockCheck.rowCount, 1, 'application row must not be locked while waiting on Drive');
      const slowApprove = await slowApprovePromise;
      assert.equal(slowApprove.statusCode, 504, slowApprove.body);
    } finally {
      globalThis.fetch = mockFetch;
      if (previousDriveTimeout === undefined) delete process.env.GOOGLE_DRIVE_TIMEOUT_MS; else process.env.GOOGLE_DRIVE_TIMEOUT_MS = previousDriveTimeout;
    }

    // 7) Slip is replaced with v2 mid-review -> stale v1 approval gets 409; v2 requires preview + explicit confirm
    await reviewApplication(submitted.id, { decision: 'slip_issue', reason: 'สลิปไม่ชัด', paymentId: submitted.paymentId }, adminAId);
    const emailRow = (await getPool().query("SELECT payload FROM integration_jobs WHERE kind='gmail.send' AND dedupe_key LIKE $1 ORDER BY id DESC LIMIT 1", [`slip-replacement:${submitted.paymentId}:%`])).rows[0];
    const token = new URL(decryptQueuedEmailText(emailRow.payload.encryptedText).match(/https?:\/\/\S*slip-replacement\?token=\S+/)[0]).searchParams.get('token');
    const replaced = await replacePaymentSlip(token, slipPayload('v2.png'));
    assert.equal(replaced.slipVersion, 2);
    const v2 = (await getPool().query('SELECT id,version FROM payment_slips WHERE payment_id=$1 ORDER BY version DESC LIMIT 1', [submitted.paymentId])).rows[0];
    assert.equal(v2.version, 2);

    assert.equal((await app.inject({
      method: 'PATCH',
      url: `/api/admin/applications/${submitted.id}/review`,
      headers: { cookie: adminACookie },
      payload: { decision: 'approve', paymentId: submitted.paymentId, slipId: v1.id, slipVersion: v1.version },
    })).statusCode, 409);

    const viewV2 = await app.inject({ method: 'GET', url: `/api/admin/payment-slips/${v2.id}`, headers: { cookie: adminACookie } });
    assert.equal(viewV2.statusCode, 200);
    assert.equal(viewV2.headers['x-payment-slip-version'], '2');

    // Preview of v2 alone is still blocked (409) until confirmed
    assert.equal((await app.inject({
      method: 'PATCH',
      url: `/api/admin/applications/${submitted.id}/review`,
      headers: { cookie: adminACookie },
      payload: { decision: 'approve', paymentId: submitted.paymentId, slipId: v2.id, slipVersion: v2.version },
    })).statusCode, 409);

    assert.equal((await confirmInspection(v2.id, submitted.paymentId, v2.version, adminACookie)).statusCode, 200);

    const approved = await app.inject({
      method: 'PATCH',
      url: `/api/admin/applications/${submitted.id}/review`,
      headers: { cookie: adminACookie },
      payload: { decision: 'approve', paymentId: submitted.paymentId, slipId: v2.id, slipVersion: v2.version },
    });
    assert.equal(approved.statusCode, 200, approved.body);
    assert.equal(approved.json().slipId, v2.id);
    assert.equal(approved.json().slipVersion, 2);

    const audit = (await getPool().query("SELECT actor_user_id,after_data FROM audit_logs WHERE entity_type='application' AND entity_id=$1 AND action='approve' ORDER BY id DESC LIMIT 1", [submitted.id])).rows[0];
    assert.equal(audit.actor_user_id, adminAId);
    assert.equal(audit.after_data.slipId, v2.id);
    assert.equal(audit.after_data.slipVersion, 2);
    assert.equal(audit.after_data.reviewerUserId, adminAId);
    assert.ok(audit.after_data.inspectedAt);
    assert.ok(audit.after_data.confirmedAt);

    // 8) Repeated approval click -> 409
    assert.equal((await app.inject({
      method: 'PATCH',
      url: `/api/admin/applications/${submitted.id}/review`,
      headers: { cookie: adminACookie },
      payload: { decision: 'approve', paymentId: submitted.paymentId, slipId: v2.id, slipVersion: v2.version },
    })).statusCode, 409);
  });

  test('enforces explicit per-reviewer slip confirmation on shared school bills and additional payments', async () => {
    const batch = await submitSchoolBatch({
      schoolName: `Slip School ${suffix}`,
      source: 'manual',
      applicants: [
        { applicant: applicantInput('Batch1'), items: [{ roundId: 'bbb-heat-2569', gradeId, format: 'paper', centerId }], pastPaperIds: [] },
        { applicant: applicantInput('Batch2'), items: [{ roundId: 'bbb-heat-2569', gradeId, format: 'paper', centerId }], pastPaperIds: [] },
      ],
      slip: slipPayload('school-v1.png'),
    }, ownerId, `coord-${suffix}@example.test`);
    const sharedSlip = (await getPool().query('SELECT id,version FROM payment_slips WHERE payment_id=$1 ORDER BY version DESC LIMIT 1', [batch.paymentId])).rows[0];

    // Admin A previews + confirms shared slip -> approves applicant 1
    assert.equal((await app.inject({ method: 'GET', url: `/api/admin/payment-slips/${sharedSlip.id}`, headers: { cookie: adminACookie } })).statusCode, 200);
    assert.equal((await confirmInspection(sharedSlip.id, batch.paymentId, sharedSlip.version, adminACookie)).statusCode, 200);
    const app1Ok = await app.inject({
      method: 'PATCH',
      url: `/api/admin/applications/${batch.applicationIds[0]}/review`,
      headers: { cookie: adminACookie },
      payload: { decision: 'approve', paymentId: batch.paymentId, slipId: sharedSlip.id, slipVersion: sharedSlip.version },
    });
    assert.equal(app1Ok.statusCode, 200, app1Ok.body);

    // Admin B cannot approve applicant 2 without viewing AND confirming the shared slip themselves
    assert.equal((await app.inject({
      method: 'PATCH',
      url: `/api/admin/applications/${batch.applicationIds[1]}/review`,
      headers: { cookie: adminBCookie },
      payload: { decision: 'approve', paymentId: batch.paymentId, slipId: sharedSlip.id, slipVersion: sharedSlip.version },
    })).statusCode, 409);

    assert.equal((await app.inject({ method: 'GET', url: `/api/admin/payment-slips/${sharedSlip.id}`, headers: { cookie: adminBCookie } })).statusCode, 200);
    assert.equal((await app.inject({
      method: 'PATCH',
      url: `/api/admin/applications/${batch.applicationIds[1]}/review`,
      headers: { cookie: adminBCookie },
      payload: { decision: 'approve', paymentId: batch.paymentId, slipId: sharedSlip.id, slipVersion: sharedSlip.version },
    })).statusCode, 409);

    assert.equal((await confirmInspection(sharedSlip.id, batch.paymentId, sharedSlip.version, adminBCookie)).statusCode, 200);
    const app2Ok = await app.inject({
      method: 'PATCH',
      url: `/api/admin/applications/${batch.applicationIds[1]}/review`,
      headers: { cookie: adminBCookie },
      payload: { decision: 'approve', paymentId: batch.paymentId, slipId: sharedSlip.id, slipVersion: sharedSlip.version },
    });
    assert.equal(app2Ok.statusCode, 200, app2Ok.body);
    const batchAudit = (await getPool().query("SELECT actor_user_id,after_data FROM audit_logs WHERE entity_type='application' AND entity_id=$1 AND action='approve' ORDER BY id DESC LIMIT 1", [batch.applicationIds[1]])).rows[0];
    assert.equal(batchAudit.actor_user_id, adminBId);
    assert.equal(batchAudit.after_data.slipId, sharedSlip.id);
    assert.equal(batchAudit.after_data.slipVersion, sharedSlip.version);
    assert.ok(batchAudit.after_data.confirmedAt);

    // Additional payment after upgrading online -> paper requires preview + confirm of the additional slip
    const onlineApp = await submitIndividualApplication({
      applicant: applicantInput('Upgrade'),
      items: [{ roundId: 'bbb-heat-2569', gradeId, format: 'online', centerId: 'center-500', examEmail: `up-${suffix}@example.test` }],
      pastPaperIds: [],
      source: 'self',
      slip: slipPayload('online.png'),
    }, ownerId);
    const initSlip = (await getPool().query('SELECT id,version FROM payment_slips WHERE payment_id=$1', [onlineApp.paymentId])).rows[0];
    assert.equal((await app.inject({ method: 'GET', url: `/api/admin/payment-slips/${initSlip.id}`, headers: { cookie: adminACookie } })).statusCode, 200);
    assert.equal((await confirmInspection(initSlip.id, onlineApp.paymentId, initSlip.version, adminACookie)).statusCode, 200);
    assert.equal((await app.inject({
      method: 'PATCH',
      url: `/api/admin/applications/${onlineApp.id}/review`,
      headers: { cookie: adminACookie },
      payload: { decision: 'approve', paymentId: onlineApp.paymentId, slipId: initSlip.id, slipVersion: initSlip.version },
    })).statusCode, 200);

    const itemRow = (await getPool().query('SELECT id FROM application_items WHERE application_id=$1', [onlineApp.id])).rows[0];
    await updateAdminApplication(onlineApp.id, {
      profile: { ...applicantInput('Upgrade'), address: {} },
      items: [{ applicationItemId: itemRow.id, roundId: 'bbb-heat-2569', gradeId, format: 'paper', centerId }],
      paymentSlip: slipPayload('additional.png'),
    }, adminAId);

    const extraPay = (await getPool().query("SELECT p.id AS payment_id, ps.id AS slip_id, ps.version FROM payments p JOIN payment_slips ps ON ps.payment_id=p.id WHERE p.application_id=$1 AND p.status='pending' ORDER BY p.created_at DESC LIMIT 1", [onlineApp.id])).rows[0];
    assert.equal((await app.inject({ method: 'GET', url: `/api/admin/payment-slips/${extraPay.slip_id}`, headers: { cookie: adminACookie } })).statusCode, 200);
    // Preview alone on additional slip -> still 409
    assert.equal((await app.inject({
      method: 'PATCH',
      url: `/api/admin/applications/${onlineApp.id}/review`,
      headers: { cookie: adminACookie },
      payload: { decision: 'approve', paymentId: extraPay.payment_id, slipId: extraPay.slip_id, slipVersion: extraPay.version },
    })).statusCode, 409);

    assert.equal((await confirmInspection(extraPay.slip_id, extraPay.payment_id, extraPay.version, adminACookie)).statusCode, 200);
    const confirmExtra = await app.inject({
      method: 'PATCH',
      url: `/api/admin/applications/${onlineApp.id}/review`,
      headers: { cookie: adminACookie },
      payload: { decision: 'approve', paymentId: extraPay.payment_id, slipId: extraPay.slip_id, slipVersion: extraPay.version },
    });
    assert.equal(confirmExtra.statusCode, 200, confirmExtra.body);
    assert.equal(confirmExtra.json().paymentOnly, true);
    const payAudit = (await getPool().query("SELECT after_data FROM audit_logs WHERE entity_type='payment' AND entity_id=$1 AND action='confirm_additional_payment' ORDER BY id DESC LIMIT 1", [extraPay.payment_id])).rows[0];
    assert.equal(payAudit.after_data.slipId, extraPay.slip_id);
    assert.equal(payAudit.after_data.slipVersion, extraPay.version);
    assert.equal(payAudit.after_data.reviewerUserId, adminAId);
    assert.ok(payAudit.after_data.confirmedAt);
  });
}
