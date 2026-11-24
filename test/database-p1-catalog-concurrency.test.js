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

  test('all catalog, exam, price, and payment-account write APIs reject requests without a revision or If-Match', async () => {
    const admin = await adminSession('reqrev');
    process.env.ADMIN_EMAILS = admin.email;
    const catalog = (await app.inject({ method: 'GET', url: '/api/catalog' })).json();
    const { revision: _omitted, ...catalogWithoutRevision } = catalog;
    const validExams = catalog.exams.filter((exam) => (!exam.isOpen || (exam.gradeOptions || []).length > 0) && (exam.roundType !== 'FINAL_X' || exam.competitionId === 'bbb') && /^\d{4}$/.test(String(exam.year || '')));

    const missingChecks = [
      await app.inject({ method: 'PUT', url: '/api/admin/catalog', headers: { cookie: admin.cookie }, payload: { ...catalogWithoutRevision, exams: validExams } }),
      await app.inject({ method: 'PUT', url: '/api/admin/catalog/options', headers: { cookie: admin.cookie }, payload: { competitions: catalog.competitions, grades: catalog.grades, centers: catalog.centers, pastPapers: catalog.pastPapers } }),
      await app.inject({ method: 'PUT', url: '/api/admin/payment-accounts', headers: { cookie: admin.cookie }, payload: { paymentAccounts: catalog.paymentAccounts } }),
      await app.inject({ method: 'POST', url: '/api/admin/exams', headers: { cookie: admin.cookie }, payload: { exams: [{ id: `missing-rev-${runId}`, competitionId: 'timo', roundType: 'HEAT', title: 'No Rev', year: '2569', openDate: '2026-01-01', closeDate: '2026-12-31', gradeOptions: ['Primary 1'], centerIds: ['center-554'], prices: { paperBased: 700, onlineExam: 600 } }] } }),
      await app.inject({ method: 'PATCH', url: '/api/admin/exams/bbb-heat-2569', headers: { cookie: admin.cookie }, payload: { prices: { paperBased: 888, onlineExam: 777 } } }),
      await app.inject({ method: 'DELETE', url: '/api/admin/exams/bbb-heat-2569', headers: { cookie: admin.cookie } }),
    ];

    for (const res of missingChecks) {
      assert.equal(res.statusCode, 428, `expected 428 for missing revision, got ${res.statusCode}: ${res.body}`);
      assert.equal(res.json().code, 'CATALOG_REVISION_REQUIRED');
      assert.equal(res.json().currentRevision, catalog.revision);
    }
  });

  test('two admin sessions with overlapping reads and writes preserve latest prices, close dates, and payment accounts with consistent snapshot revisions', async () => {
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

    // Admin A changes payment accounts
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
    assert.equal(saveA.headers.etag, `"catalog-rev-${catalogA.revision + 1}"`);

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

    // Legacy full-catalog replace with stale body revision -> 409 Conflict
    const validExamsB = catalogB.exams.filter((exam) => (!exam.isOpen || (exam.gradeOptions || []).length > 0) && (exam.roundType !== 'FINAL_X' || exam.competitionId === 'bbb') && /^\d{4}$/.test(String(exam.year || '')));
    const staleFullB = await app.inject({
      method: 'PUT',
      url: '/api/admin/catalog',
      headers: { cookie: adminB.cookie },
      payload: { ...catalogB, exams: validExamsB, centers: [...catalogB.centers, newCenter] },
    });
    assert.equal(staleFullB.statusCode, 409, staleFullB.body);
    assert.equal(staleFullB.json().code, 'CATALOG_REVISION_CONFLICT');

    // Verify Admin A's payment account is intact and Admin B's stale center was NOT written
    const afterConflict = (await app.inject({ method: 'GET', url: '/api/catalog' })).json();
    assert.ok(afterConflict.paymentAccounts.some((acc) => acc.id === newAccountId && acc.showInForm === true));
    assert.ok(!afterConflict.centers.some((center) => center.code === newCenterCode));

    // Create a round for overlapping read/write tests on price & closeDate
    const createdRoundId = `oc10-round-${runId}`;
    const createExam = await app.inject({
      method: 'POST',
      url: '/api/admin/exams',
      headers: { cookie: adminA.cookie, 'if-match': `"catalog-rev-${afterConflict.revision}"` },
      payload: {
        exams: [{
          id: createdRoundId,
          competitionId: 'timo',
          roundType: 'HEAT',
          title: 'TIMO Concurrency Round',
          year: '2569',
          openDate: '2026-01-01',
          closeDate: '2026-10-15',
          gradeOptions: ['Primary 1'],
          centerIds: ['center-554'],
          prices: { paperBased: 800, onlineExam: 700 },
        }],
      },
    });
    assert.equal(createExam.statusCode, 201, createExam.body);
    const revAfterCreate = createExam.json().revision;
    assert.equal(revAfterCreate, afterConflict.revision + 1);

    // Overlapping concurrent operations: Admin A updates price & closeDate while Admin B concurrently reads /api/catalog and attempts a competing write at the same revision
    const [writeA, readMid, writeBCompeting] = await Promise.all([
      app.inject({
        method: 'PATCH',
        url: `/api/admin/exams/${createdRoundId}`,
        headers: { cookie: adminA.cookie, 'if-match': `"catalog-rev-${revAfterCreate}"` },
        payload: { closeDate: '2026-11-30', prices: { paperBased: 950, onlineExam: 850 } },
      }),
      app.inject({ method: 'GET', url: '/api/catalog' }),
      app.inject({
        method: 'PUT',
        url: '/api/admin/catalog/options',
        headers: { cookie: adminB.cookie, 'if-match': `"catalog-rev-${revAfterCreate}"` },
        payload: {
          competitions: afterConflict.competitions,
          grades: afterConflict.grades,
          centers: [...afterConflict.centers, newCenter],
          pastPapers: afterConflict.pastPapers,
        },
      }),
    ]);

    // Exactly ONE of the two competing writes at revAfterCreate must succeed (200) and the other MUST fail with 412!
    const statuses = [writeA.statusCode, writeBCompeting.statusCode].sort();
    assert.deepEqual(statuses, [200, 412], `expected one 200 and one 412, got A=${writeA.statusCode}, B=${writeBCompeting.statusCode}`);

    // The overlapping GET /api/catalog snapshot MUST be internally consistent (no torn read where revision jumped without matching data)
    const snap = readMid.json();
    const snapRound = snap.exams.find((e) => e.id === createdRoundId);
    assert.ok(snapRound);
    if (snap.revision === revAfterCreate) {
      assert.equal(snapRound.prices.paperBased, 800);
      assert.equal(snapRound.closeDate, '2026-10-15');
    } else if (writeA.statusCode === 200) {
      assert.equal(snapRound.prices.paperBased, 950);
      assert.equal(snapRound.closeDate, '2026-11-30');
    }

    // Complete whichever operation got 412 after reloading latest revision so BOTH changes land cleanly
    const reloadedRes = await app.inject({ method: 'GET', url: '/api/catalog' });
    const reloaded = reloadedRes.json();
    if (writeA.statusCode === 412) {
      const retryA = await app.inject({
        method: 'PATCH',
        url: `/api/admin/exams/${createdRoundId}`,
        headers: { cookie: adminA.cookie, 'if-match': reloadedRes.headers.etag },
        payload: { closeDate: '2026-11-30', prices: { paperBased: 950, onlineExam: 850 } },
      });
      assert.equal(retryA.statusCode, 200, retryA.body);
      assert.equal(retryA.json().exam.prices.paperBased, 950);
      assert.equal(retryA.json().exam.closeDate, '2026-11-30');
      assert.equal(retryA.headers.etag, `"catalog-rev-${retryA.json().revision}"`);
    } else {
      const retryB = await app.inject({
        method: 'PUT',
        url: '/api/admin/catalog/options',
        headers: { cookie: adminB.cookie, 'if-match': reloadedRes.headers.etag },
        payload: {
          competitions: reloaded.competitions,
          grades: reloaded.grades,
          centers: [...reloaded.centers, newCenter],
          pastPapers: reloaded.pastPapers,
        },
      });
      assert.equal(retryB.statusCode, 200, retryB.body);
      assert.equal(retryB.headers.etag, `"catalog-rev-${retryB.json().catalog.revision}"`);
    }

    // Final check: latest payment account, exam price, closeDate, AND center are ALL preserved!
    const finalRes = await app.inject({ method: 'GET', url: '/api/catalog' });
    const finalCatalog = finalRes.json();
    const finalRound = finalCatalog.exams.find((e) => e.id === createdRoundId);
    assert.ok(finalCatalog.paymentAccounts.some((acc) => acc.id === newAccountId && acc.showInForm === true), 'latest payment account preserved');
    assert.ok(finalCatalog.centers.some((center) => center.code === newCenterCode), 'latest center preserved');
    assert.equal(finalRound.prices.paperBased, 950, 'latest price preserved');
    assert.equal(finalRound.closeDate, '2026-11-30', 'latest close date preserved');

    const archiveExam = await app.inject({
      method: 'DELETE',
      url: `/api/admin/exams/${createdRoundId}`,
      headers: { cookie: adminA.cookie, 'if-match': finalRes.headers.etag },
    });
    assert.equal(archiveExam.statusCode, 200, archiveExam.body);
  });
}
