import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { app } from '../server/index.js';
import { getPool } from '../server/db.js';
import { seed } from '../server/seed.js';

const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
  test('OCEC-10 catalog concurrency tests require a disposable database', { skip: 'Use npm run test:db' }, () => {});
} else {
  const target = new URL(testUrl);
  if (!['localhost', '127.0.0.1', '::1'].includes(target.hostname) || !target.pathname.includes('test') || process.env.DATABASE_URL !== testUrl) {
    throw new Error('Use a disposable local test database');
  }
  app.log.level = 'silent';
  const runId = randomBytes(5).toString('hex');

  async function adminSession(tag) {
    const email = `admin-cat-${tag}-${runId}@example.test`;
    const row = (await getPool().query(
      'INSERT INTO users(google_sub,email,display_name,is_admin) VALUES($1,$2,$3,true) RETURNING id,email',
      [`cat-admin-${tag}-${runId}`, email, `Catalog Admin ${tag}`],
    )).rows[0];
    const token = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
    await getPool().query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')", [createHash('sha256').update(token).digest('hex'), row.id]);
    return { id: row.id, email: row.email, cookie: `ocec_session=${token}` };
  }

  test.before(async () => {
    await seed();
  });

  test.after(async () => {
    await app.close();
    await getPool().end();
  });

  test('two admin sessions: saving payment account bumps revision and blocks stale center save without overwriting the new payment account', async () => {
    const adminA = await adminSession('a');
    const adminB = await adminSession('b');
    process.env.ADMIN_EMAILS = `${adminA.email},${adminB.email}`;

    // Both admins load catalog at the same initial revision
    const resA = await app.inject({ method: 'GET', url: '/api/catalog' });
    const resB = await app.inject({ method: 'GET', url: '/api/catalog' });
    assert.equal(resA.statusCode, 200);
    assert.equal(resB.statusCode, 200);
    const catalogA = resA.json();
    const catalogB = resB.json();
    const initialEtag = resA.headers.etag;
    assert.ok(initialEtag, 'GET /api/catalog must return an ETag');
    assert.equal(catalogA.revision, catalogB.revision);

    // Admin A changes payment accounts (adds a new active form account)
    const newAccountId = `acct-fresh-${runId}`;
    const updatedAccountsA = [
      ...catalogA.paymentAccounts.map((acc) => ({ ...acc, showInForm: false })),
      { id: newAccountId, bankName: 'SCB', accountName: 'OCEC Fresh Account', accountNumber: '999-8-77777-6', category: 'president', showInForm: true, active: true },
    ];
    const saveA = await app.inject({
      method: 'PUT',
      url: '/api/admin/payment-accounts',
      headers: { cookie: adminA.cookie, 'if-match': initialEtag },
      payload: { paymentAccounts: updatedAccountsA, expectedRevision: catalogA.revision },
    });
    assert.equal(saveA.statusCode, 200, saveA.body);
    assert.equal(saveA.json().revision, catalogA.revision + 1);
    assert.notEqual(saveA.headers.etag, initialEtag);

    // Admin B (still holding stale initialEtag / catalogB.revision) tries to save a new center via general options endpoint
    const newCenterCode = '771';
    const newCenter = { id: `center-${newCenterCode}`, code: newCenterCode, name: 'Stale Session Center', active: true };
    const staleOptionsB = await app.inject({
      method: 'PUT',
      url: '/api/admin/catalog/options',
      headers: { cookie: adminB.cookie, 'if-match': initialEtag },
      payload: {
        competitions: catalogB.competitions,
        grades: catalogB.grades,
        centers: [...catalogB.centers, newCenter],
        pastPapers: catalogB.pastPapers,
        expectedRevision: catalogB.revision,
      },
    });
    assert.equal(staleOptionsB.statusCode, 412, staleOptionsB.body);
    assert.equal(staleOptionsB.json().code, 'CATALOG_REVISION_CONFLICT');
    assert.equal(staleOptionsB.json().currentRevision, catalogA.revision + 1);

    // Even if Admin B tries the legacy full-catalog replace endpoint with stale body revision -> 409 Conflict!
    const validExamsB = catalogB.exams.filter((exam) => (!exam.isOpen || (exam.gradeOptions || []).length > 0) && (exam.roundType !== 'FINAL_X' || exam.competitionId === 'bbb') && /^\d{4}$/.test(String(exam.year || '')));
    const staleFullB = await app.inject({
      method: 'PUT',
      url: '/api/admin/catalog',
      headers: { cookie: adminB.cookie },
      payload: { ...catalogB, exams: validExamsB, centers: [...catalogB.centers, newCenter] },
    });
    assert.equal(staleFullB.statusCode, 409, staleFullB.body);
    assert.equal(staleFullB.json().code, 'CATALOG_REVISION_CONFLICT');

    // Verify Admin A's payment account is completely intact and Admin B's stale center was NOT written
    const afterConflict = (await app.inject({ method: 'GET', url: '/api/catalog' })).json();
    assert.ok(afterConflict.paymentAccounts.some((acc) => acc.id === newAccountId && acc.showInForm === true));
    assert.ok(!afterConflict.centers.some((center) => center.code === newCenterCode));

    // Admin B reloads latest catalog and saves its center change via separated general options endpoint
    const reloadedRes = await app.inject({ method: 'GET', url: '/api/catalog' });
    const reloaded = reloadedRes.json();
    const saveOptionsB = await app.inject({
      method: 'PUT',
      url: '/api/admin/catalog/options',
      headers: { cookie: adminB.cookie, 'if-match': reloadedRes.headers.etag },
      payload: {
        competitions: reloaded.competitions,
        grades: reloaded.grades,
        centers: [...reloaded.centers, newCenter],
        pastPapers: reloaded.pastPapers,
        expectedRevision: reloaded.revision,
      },
    });
    assert.equal(saveOptionsB.statusCode, 200, saveOptionsB.body);
    const finalCatalog = (await app.inject({ method: 'GET', url: '/api/catalog' })).json();
    assert.equal(finalCatalog.revision, reloaded.revision + 1);
    assert.ok(finalCatalog.paymentAccounts.some((acc) => acc.id === newAccountId && acc.showInForm === true), 'Admin A payment account must stay intact');
    assert.ok(finalCatalog.centers.some((center) => center.code === newCenterCode), 'Admin B center must be saved after reload');

    // Exam round create/patch/delete also respect If-Match revision checks independently
    const createdRoundId = `oc10-round-${runId}`;
    const createExam = await app.inject({
      method: 'POST',
      url: '/api/admin/exams',
      headers: { cookie: adminA.cookie, 'if-match': `"catalog-rev-${finalCatalog.revision}"` },
      payload: {
        exams: [{
          id: createdRoundId,
          competitionId: 'timo',
          roundType: 'HEAT',
          title: 'TIMO Concurrency Round',
          year: '2569',
          openDate: '2026-01-01',
          closeDate: '2026-12-31',
          gradeOptions: ['Primary 1'],
          centerIds: ['center-554'],
          prices: { paperBased: 800, onlineExam: 700 },
        }],
      },
    });
    assert.equal(createExam.statusCode, 201, createExam.body);
    const revAfterCreate = createExam.json().revision;
    assert.equal(revAfterCreate, finalCatalog.revision + 1);

    // Stale PATCH on exam round fails with 412; fresh PATCH succeeds
    const stalePatch = await app.inject({
      method: 'PATCH',
      url: `/api/admin/exams/${createdRoundId}`,
      headers: { cookie: adminB.cookie, 'if-match': `"catalog-rev-${finalCatalog.revision}"` },
      payload: { prices: { paperBased: 950, onlineExam: 850 } },
    });
    assert.equal(stalePatch.statusCode, 412, stalePatch.body);

    const freshPatch = await app.inject({
      method: 'PATCH',
      url: `/api/admin/exams/${createdRoundId}`,
      headers: { cookie: adminB.cookie, 'if-match': `"catalog-rev-${revAfterCreate}"` },
      payload: { prices: { paperBased: 950, onlineExam: 850 } },
    });
    assert.equal(freshPatch.statusCode, 200, freshPatch.body);
    assert.equal(freshPatch.json().exam.prices.paperBased, 950);

    const revAfterPatch = freshPatch.json().revision;
    const archiveExam = await app.inject({
      method: 'DELETE',
      url: `/api/admin/exams/${createdRoundId}`,
      headers: { cookie: adminA.cookie, 'if-match': `"catalog-rev-${revAfterPatch}"` },
    });
    assert.equal(archiveExam.statusCode, 200, archiveExam.body);
  });
}
