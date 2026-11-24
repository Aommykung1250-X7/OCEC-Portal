import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { installMockGoogleWorkspace } from './e2e/google-workspace-mock.js';
import { createHash, randomUUID } from 'node:crypto';
import { app } from '../server/index.js';
import { createIndividualDraft, createSchoolDraft, submitIndividualApplication, uploadCertificatePhoto } from '../server/applications.js';
import { getPool } from '../server/db.js';
import { loadCatalog, saveCatalogSnapshot } from '../server/catalog.js';
import { seed } from '../server/seed.js';
import { importResultRows, publishResultBatch } from '../server/results.js';
import { bindFinalGrantToUser, createFinalVerificationGrant, finalGrantHash, listFinalEligibilityForUser, searchSchoolFinalEligibility } from '../server/finalEligibility.js';

if (!process.env.TEST_DATABASE_URL) {
  test('Final X database workflow requires disposable local PostgreSQL', { skip: 'Use npm run test:db' }, () => {});
} else {
  test('BBB Final medal grants Final X to its owner or verified school applicant, with server rejection of bypasses', async () => {
    await seed();
    const db = getPool();
    const user = (await db.query("INSERT INTO users(google_sub,email,display_name) VALUES('final-x-user','final-x@example.test','Final X') RETURNING id")).rows[0].id;
    const other = (await db.query("INSERT INTO users(google_sub,email,display_name) VALUES('final-x-other','final-x-other@example.test','Other') RETURNING id")).rows[0].id;
    const gradeId = (await db.query("SELECT id FROM grade_catalog WHERE label='Primary 1'")).rows[0].id;
    const centerId = (await db.query("SELECT id FROM exam_centers WHERE code='554'")).rows[0].id;
    await db.query("UPDATE exam_rounds SET open_date=current_date-1,close_date=current_date+1 WHERE id='bbb-heat-2569'");
    const applicant = { firstNameEn: 'Finalx', lastNameEn: 'Student', dateOfBirth: '2017-01-01', schoolName: 'Test School', contactEmail: 'final-x@example.test', contactPhone: '0812345678' };
    const item = { roundId: 'bbb-heat-2569', gradeId, format: 'paper', centerId };
    const source = await createIndividualDraft({ applicant, items: [item], pastPaperIds: [] }, user);
    for (const [id, type] of [['test-bbb-final', 'FINAL'], ['test-bbb-x', 'FINAL_X']]) {
      await db.query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date,is_open)
        VALUES($1,'bbb',$1,'2569',$2,current_date-1,current_date+1,true)`, [id,type]);
      await db.query('INSERT INTO exam_round_grades(exam_round_id,grade_id) VALUES($1,$2)', [id,gradeId]);
      await db.query('INSERT INTO exam_round_centers(exam_round_id,center_id) VALUES($1,$2)', [id,centerId]);
    }
    const sourceItem = (await db.query("UPDATE application_items SET exam_round_id='test-bbb-final',exam_number='FINAL123' WHERE application_id=$1 RETURNING id", [source.id])).rows[0].id;
    await db.query("UPDATE applications SET status='approved' WHERE id=$1", [source.id]);
    await importResultRows('test-bbb-final','final-results.xlsx', [{ candidateNo: 'FINAL123', grade: 'Primary 1', school: 'Test School', candidate: 'Finalx Student', award: 'GOLD AWARD' }], user);
    const published = await publishResultBatch('test-bbb-final', user);
    assert.equal(published.eligibleForFinal, 1);
    assert.equal(published.openedFinalRounds, 1);
    await db.query('UPDATE results SET eligible_for_final=false WHERE application_item_id=$1', [sourceItem]);
    await db.query(await readFile(new URL('../server/migrations/019_bbb_final_x_eligibility.sql', import.meta.url), 'utf8'));
    assert.equal((await db.query('SELECT eligible_for_final FROM results WHERE application_item_id=$1', [sourceItem])).rows[0].eligible_for_final, true);
    assert.equal((await listFinalEligibilityForUser(user)).find((choice) => choice.item.roundId === 'test-bbb-x')?.item.roundType, 'FINAL_X');
    assert.deepEqual(await listFinalEligibilityForUser(other), []);
    await db.query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date)
      VALUES('invalid-hkiso-x','hkiso','Invalid HKISO X','2569','FINAL_X',current_date-1,current_date+1)`);
    await db.query("INSERT INTO exam_round_grades(exam_round_id,grade_id) VALUES('invalid-hkiso-x',$1)", [gradeId]);
    await db.query("INSERT INTO exam_round_centers(exam_round_id,center_id) VALUES('invalid-hkiso-x',$1)", [centerId]);
    const catalogSnapshot = await loadCatalog();
    const focusedCatalog = {
      ...catalogSnapshot,
      exams: catalogSnapshot.exams.filter((exam) => exam.id === 'bbb-heat-2569' || exam.id === 'invalid-hkiso-x'),
    };
    await assert.rejects(saveCatalogSnapshot(focusedCatalog, user), /Final X เปิดให้เฉพาะ BBB/);
    await assert.rejects(createIndividualDraft({ applicant, items: [{ ...item, roundId: 'invalid-hkiso-x' }], pastPaperIds: [] }, user), /Final X เปิดให้เฉพาะ BBB/);
    const candidate = { applicant, sourceHeatApplicationId: source.id, items: [{ ...item, roundId: 'test-bbb-x' }], pastPaperIds: [] };
    await assert.rejects(createIndividualDraft({ ...candidate, sourceHeatApplicationId: undefined }, user), { statusCode: 403 });
    await assert.rejects(createIndividualDraft({ ...candidate, sourceHeatApplicationId: randomUUID() }, user), { statusCode: 403 });
    await assert.rejects(createIndividualDraft(candidate, other), { statusCode: 403 });
    for (const award of ['1ST AWARD', 'MERIT AWARD']) {
      await db.query('UPDATE results SET award=$1 WHERE application_item_id=$2', [award,sourceItem]);
      assert.deepEqual(await listFinalEligibilityForUser(user), []);
      await assert.rejects(createIndividualDraft(candidate, user), { statusCode: 403 });
    }
    await db.query("UPDATE results SET award='SILVER MEDAL',published_at=NULL WHERE application_item_id=$1", [sourceItem]);
    await assert.rejects(createIndividualDraft(candidate, user), { statusCode: 403 });
    await db.query('UPDATE results SET published_at=now() WHERE application_item_id=$1', [sourceItem]);
    await db.query("UPDATE exam_rounds SET year='2570' WHERE id='test-bbb-x'");
    await assert.rejects(createIndividualDraft(candidate, user), { statusCode: 403 });
    await db.query("UPDATE exam_rounds SET year='2569',final_manually_closed=true WHERE id='test-bbb-x'");
    await assert.rejects(createIndividualDraft(candidate, user));
    await db.query("UPDATE exam_rounds SET final_manually_closed=false WHERE id='test-bbb-x'");
    const ownDraft = await createIndividualDraft(candidate, user);
    assert.ok(ownDraft.id);
    await db.query('DELETE FROM application_items WHERE application_id=$1', [ownDraft.id]);
    await db.query('DELETE FROM applications WHERE id=$1', [ownDraft.id]);
    await db.query("UPDATE applications SET source='school' WHERE id=$1", [source.id]);
    // Invitations also work when the target round was added after the results.
    await db.query("DELETE FROM final_invitations WHERE final_exam_round_id='test-bbb-x'");
    const choices = await searchSchoolFinalEligibility('Finalx Student');
    assert.equal(choices[0].round, 'FINAL X');
    await assert.rejects(createIndividualDraft(candidate, user), { statusCode: 403 });
    await assert.rejects(createFinalVerificationGrant({ candidateName: 'Finalx Student', finalRoundId: 'test-bbb-x', phoneLast4: '0000' }), { statusCode: 403 });
    const token = await createFinalVerificationGrant({ candidateName: 'Finalx Student', finalRoundId: 'test-bbb-x', phoneLast4: '5678' });
    const grant = (await db.query('SELECT id FROM final_verification_grants WHERE token_hash=$1', [finalGrantHash(token)])).rows[0];
    await bindFinalGrantToUser(grant.id, other);
    assert.equal((await listFinalEligibilityForUser(other, token))[0].item.roundType, 'FINAL_X');
    const schoolDraft = await createIndividualDraft(candidate, other, token);
    await db.query('DELETE FROM application_items WHERE application_id=$1', [schoolDraft.id]);
    await db.query('DELETE FROM applications WHERE id=$1', [schoolDraft.id]);
    await db.query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date)
      VALUES('test-hkiso-photo','hkiso','HKISO','2569','FINAL',current_date-20,current_date-1)`);
    await db.query(`INSERT INTO application_items(application_id,exam_round_id,grade_id,format,center_id,fee_satang,snapshot,duplicate_key,exam_number)
      SELECT application_id,'test-hkiso-photo',grade_id,format,center_id,fee_satang,snapshot,'photo-second-item','ISO456'
      FROM application_items WHERE id=$1`, [sourceItem]);
    await db.query("UPDATE exam_rounds SET close_date=current_date-1 WHERE id='test-bbb-final'");
    const originalFetch = globalThis.fetch;
    const folders = [];
    const uploads = [];
    try {
      const finalPhoto={fileName:'photo.jpg',mimeType:'image/jpeg',dataBase64:Buffer.from([255,216,255,0,1,2,3]).toString('base64')};
      const finalCandidate={...candidate,items:candidate.items.map(item=>({...item,packageCode:'onsite_ceremony',shirtSize:'M',guests:[]})),certificatePhoto:finalPhoto};
      await assert.rejects(submitIndividualApplication({ ...finalCandidate, source: 'final', slip: { fileName: 'slip.png', mimeType: 'image/png', dataBase64: Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64') } }, other, token), (error) => error.statusCode === 503 && error.message.includes('Google Workspace'));
      assert.equal((await db.query("SELECT claimed_application_id FROM final_invitations WHERE final_exam_round_id='test-bbb-x' AND heat_application_item_id=$1", [sourceItem])).rows[0].claimed_application_id, null);
      await installMockGoogleWorkspace();
      const mockFetch = globalThis.fetch;
      globalThis.fetch = async (url, options = {}) => {
        const target = new URL(url);
        if (target.pathname === '/drive/v3/files' && options.method === 'POST') folders.push(JSON.parse(options.body));
        if (target.pathname === '/upload/drive/v3/files') uploads.push(options.body);
        return mockFetch(url, options);
      };
      const submission = { ...finalCandidate, source: 'final', slip: { fileName: 'slip.png', mimeType: 'image/png', dataBase64: Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64') } };
      const submitted = await submitIndividualApplication(submission, other, token);
      assert.equal((await db.query("SELECT claimed_application_id FROM final_invitations WHERE final_exam_round_id='test-bbb-x' AND heat_application_item_id=$1", [sourceItem])).rows[0].claimed_application_id, submitted.id);
      await assert.rejects(submitIndividualApplication(submission, other, token), (error) => [403,409].includes(error.statusCode));
      folders.length = 0;
      uploads.length = 0;
      const image = Buffer.from([255,216,255,0,1,2,3]);
      const uploaded = await uploadCertificatePhoto(source.id, { fileName: 'photo.jpg', mimeType: 'image/jpeg', dataBase64: image.toString('base64') }, user, 'final-x@example.test');
      assert.equal(uploaded.photo.itemCount, 2);
      assert.deepEqual([folders.slice(0, 3), folders.slice(3)].map(group => group.map(folder => folder.name)).sort((a, b) => a[1].localeCompare(b[1])), [['2569','BBB','Final'], ['2569','HKISO','Final']]);
      assert.equal(uploads.length, 2);
      assert.equal(uploads.filter(body => body.includes(Buffer.from('Finalx_Student.jpg'))).length,2);
      assert.ok(uploads.every(body=>!body.includes(Buffer.from('FINAL123_Finalx')) && !body.includes(Buffer.from('ISO456_Finalx'))));
      assert.ok(uploads.every((body) => body.includes(image)));
      await importResultRows('test-hkiso-photo','hkiso-final.xlsx', [{ candidateNo: 'ISO456', grade: 'Primary 1', school: 'Test School', candidate: 'Finalx Student', award: 'GOLD AWARD' }], user);
      const terminal = await publishResultBatch('test-hkiso-photo', user);
      assert.equal(terminal.eligibleForFinal, 0);
      assert.equal(terminal.openedFinalRounds, 0);
      assert.equal((await db.query("SELECT count(*)::int AS total FROM final_invitations WHERE final_exam_round_id='invalid-hkiso-x'")).rows[0].total, 0);
    } finally {
      globalThis.fetch = originalFetch;
      await db.query("DELETE FROM google_workspace_connection WHERE account_email='workspace@ocec.test'");
    }
  });

  test('real source=final BBB Final applications from both self Heat and school Heat grant Final X to their owners via API', async () => {
    await seed();
    app.log.level = 'silent';
    const db = getPool();
    const suffix = randomUUID().slice(0, 8);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const slip = { fileName: 'slip.png', mimeType: 'image/png', dataBase64: png.toString('base64') };
    const certificatePhoto = { fileName: 'photo.png', mimeType: 'image/png', dataBase64: png.toString('base64') };

    const users = await db.query(`INSERT INTO users(google_sub,email,display_name,is_admin) VALUES
      ($1,$2,'Self Student',false),
      ($3,$4,'School Coordinator',false),
      ($5,$6,'School Student',false),
      ($7,$8,'Bystander',false),
      ($9,$10,'FinalX Admin',true)
      RETURNING id,email`, [
      `fx-self-${suffix}`, `fx-self-${suffix}@example.test`,
      `fx-coord-${suffix}`, `fx-coord-${suffix}@example.test`,
      `fx-school-stu-${suffix}`, `fx-school-stu-${suffix}@example.test`,
      `fx-other-${suffix}`, `fx-other-${suffix}@example.test`,
      `fx-admin-${suffix}`, `fx-admin-${suffix}@example.test`,
    ]);
    const [selfOwner, coordinator, schoolStudent, bystander, admin] = users.rows.map((row) => row.id);
    const previousAdmins = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = users.rows[4].email;

    async function cookieFor(userId) {
      const token = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
      await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')", [createHash('sha256').update(token).digest('hex'), userId]);
      return `ocec_session=${token}`;
    }

    const [selfCookie, coordCookie, schoolStudentCookie, bystanderCookie, adminCookie] = await Promise.all(
      [selfOwner, coordinator, schoolStudent, bystander, admin].map(cookieFor),
    );
    const gradeId = (await db.query("SELECT id FROM grade_catalog WHERE label='Primary 1'")).rows[0].id;
    const centerId = (await db.query("SELECT id FROM exam_centers WHERE code='554'")).rows[0].id;
    const heatRoundId = `bbb-heat-fx-${suffix}`;
    const finalRoundId = `bbb-final-fx-${suffix}`;
    const finalXRoundId = `bbb-finalx-fx-${suffix}`;

    for (const [id, type] of [[heatRoundId, 'HEAT'], [finalRoundId, 'FINAL'], [finalXRoundId, 'FINAL_X']]) {
      await db.query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date,is_open)
        VALUES($1,'bbb',$1,'2569',$2,current_date-1,current_date+1,true)`, [id, type]);
      await db.query('INSERT INTO exam_round_grades(exam_round_id,grade_id) VALUES($1,$2)', [id, gradeId]);
      await db.query('INSERT INTO exam_round_centers(exam_round_id,center_id) VALUES($1,$2)', [id, centerId]);
    }

    const originalFetch = globalThis.fetch;
    try {
      await installMockGoogleWorkspace();

      // 1) Self Heat application -> eligible for BBB Final
      const selfApplicant = { firstNameEn: `SelfFx${suffix}`, lastNameEn: 'Runner', dateOfBirth: '2017-01-01', schoolName: 'Self School', contactEmail: `self-${suffix}@example.test`, contactPhone: '0811112222' };
      const selfHeat = await submitIndividualApplication({
        applicant: selfApplicant,
        items: [{ roundId: heatRoundId, gradeId, format: 'paper', centerId }],
        pastPaperIds: [],
        source: 'self',
        slip,
      }, selfOwner);
      await db.query("UPDATE applications SET status='approved' WHERE id=$1", [selfHeat.id]);
      await db.query("UPDATE application_items SET exam_number=$2 WHERE application_id=$1", [selfHeat.id, `HSELF${suffix}`]);

      // 2) School Heat application -> eligible for BBB Final via school grant
      const schoolApplicant = { firstNameEn: `SchoolFx${suffix}`, lastNameEn: 'Runner', dateOfBirth: '2017-02-02', schoolName: 'Batch School', contactEmail: `school-${suffix}@example.test`, contactPhone: '0822223333' };
      const schoolDraft = await createSchoolDraft({
        schoolName: 'Batch School',
        source: 'manual',
        applicants: [{ applicant: schoolApplicant, items: [{ roundId: heatRoundId, gradeId, format: 'paper', centerId }], pastPaperIds: [] }],
      }, coordinator, users.rows[1].email);
      const schoolHeatId = schoolDraft.applicationIds[0];
      await db.query("UPDATE applications SET status='approved' WHERE id=$1", [schoolHeatId]);
      await db.query("UPDATE application_items SET exam_number=$2 WHERE application_id=$1", [schoolHeatId, `HSCH${suffix}`]);

      // Publish Heat results -> both qualify for BBB Final
      await importResultRows(heatRoundId, 'heat.xlsx', [
        { candidateNo: `HSELF${suffix}`, grade: 'Primary 1', schoolName: 'Self School', candidateName: `${selfApplicant.firstNameEn} Runner`, award: '1ST AWARD' },
        { candidateNo: `HSCH${suffix}`, grade: 'Primary 1', schoolName: 'Batch School', candidateName: `${schoolApplicant.firstNameEn} Runner`, award: '2ND AWARD' },
      ], admin);
      const heatPublished = await publishResultBatch(heatRoundId, admin);
      assert.equal(heatPublished.eligibleForFinal, 2);

      // Submit real BBB Final (source='final') for Self Heat owner via API
      const selfFinalRes = await app.inject({
        method: 'POST',
        url: '/api/applications/submit',
        headers: { cookie: selfCookie },
        payload: {
          applicant: selfApplicant,
          items: [{ roundId: finalRoundId, gradeId, format: 'paper', centerId, packageCode: 'onsite_ceremony', shirtSize: 'M', guests: [] }],
          pastPaperIds: [],
          sourceHeatApplicationId: selfHeat.id,
          source: 'final',
          slip,
          certificatePhoto,
        },
      });
      assert.equal(selfFinalRes.statusCode, 201, selfFinalRes.body);
      const selfFinalId = selfFinalRes.json().application.id;
      assert.equal((await db.query('SELECT source FROM applications WHERE id=$1', [selfFinalId])).rows[0].source, 'final');

      // Submit real BBB Final (source='final') for School Heat student via school grant + student Google account
      const schoolGrantToken = await createFinalVerificationGrant({
        candidateName: `${schoolApplicant.firstNameEn} Runner`,
        finalRoundId,
        phoneLast4: '3333',
      });
      const schoolGrantRow = (await db.query('SELECT id FROM final_verification_grants WHERE token_hash=$1', [finalGrantHash(schoolGrantToken)])).rows[0];
      await bindFinalGrantToUser(schoolGrantRow.id, schoolStudent);
      const schoolFinalRes = await app.inject({
        method: 'POST',
        url: '/api/applications/submit',
        headers: { cookie: `${schoolStudentCookie}; ocec_final_verification=${schoolGrantToken}` },
        payload: {
          applicant: schoolApplicant,
          items: [{ roundId: finalRoundId, gradeId, format: 'paper', centerId, packageCode: 'onsite_ceremony', shirtSize: 'S', guests: [] }],
          pastPaperIds: [],
          sourceHeatApplicationId: schoolHeatId,
          source: 'final',
          slip,
          certificatePhoto,
        },
      });
      assert.equal(schoolFinalRes.statusCode, 201, schoolFinalRes.body);
      const schoolFinalId = schoolFinalRes.json().application.id;
      assert.equal((await db.query('SELECT source,owner_user_id FROM applications WHERE id=$1', [schoolFinalId])).rows[0].source, 'final');

      // Admin inspects, explicitly confirms, and approves both real BBB Final applications via API
      for (const appId of [selfFinalId, schoolFinalId]) {
        const payRow = (await db.query(`SELECT p.id AS payment_id, ps.id AS slip_id, ps.version
          FROM payments p JOIN payment_slips ps ON ps.payment_id=p.id
          WHERE p.application_id=$1 ORDER BY ps.version DESC LIMIT 1`, [appId])).rows[0];
        const viewSlip = await app.inject({ method: 'GET', url: `/api/admin/payment-slips/${payRow.slip_id}`, headers: { cookie: adminCookie } });
        assert.equal(viewSlip.statusCode, 200, viewSlip.body);
        const confirmSlip = await app.inject({
          method: 'POST',
          url: `/api/admin/payment-slips/${payRow.slip_id}/confirm-inspection`,
          headers: { cookie: adminCookie },
          payload: { paymentId: payRow.payment_id, slipVersion: payRow.version },
        });
        assert.equal(confirmSlip.statusCode, 200, confirmSlip.body);
        const approved = await app.inject({
          method: 'PATCH',
          url: `/api/admin/applications/${appId}/review`,
          headers: { cookie: adminCookie },
          payload: { decision: 'approve', paymentId: payRow.payment_id, slipId: payRow.slip_id, slipVersion: payRow.version },
        });
        assert.equal(approved.statusCode, 200, approved.body);
      }

      // Assign Final exam numbers and publish BBB Final medal results
      await db.query('UPDATE application_items SET exam_number=$2 WHERE application_id=$1', [selfFinalId, `FSELF${suffix}`]);
      await db.query('UPDATE application_items SET exam_number=$2 WHERE application_id=$1', [schoolFinalId, `FSCH${suffix}`]);
      await importResultRows(finalRoundId, 'bbb-final.xlsx', [
        { candidateNo: `FSELF${suffix}`, grade: 'Primary 1', schoolName: 'Self School', candidateName: `${selfApplicant.firstNameEn} Runner`, award: 'GOLD AWARD' },
        { candidateNo: `FSCH${suffix}`, grade: 'Primary 1', schoolName: 'Batch School', candidateName: `${schoolApplicant.firstNameEn} Runner`, award: 'BRONZE MEDAL' },
      ], admin);
      const finalPublished = await publishResultBatch(finalRoundId, admin);
      assert.equal(finalPublished.eligibleForFinal, 2);

      // Both owners of source='final' applications see Final X eligibility via API!
      const selfEligRes = await app.inject({ method: 'GET', url: '/api/applications/final-eligibility', headers: { cookie: selfCookie } });
      assert.equal(selfEligRes.statusCode, 200);
      assert.ok(selfEligRes.json().choices.some((c) => c.sourceHeatApplicationId === selfFinalId && c.item.roundId === finalXRoundId && c.item.roundType === 'FINAL_X'));

      const schoolStuEligRes = await app.inject({ method: 'GET', url: '/api/applications/final-eligibility', headers: { cookie: schoolStudentCookie } });
      assert.equal(schoolStuEligRes.statusCode, 200);
      assert.ok(schoolStuEligRes.json().choices.some((c) => c.sourceHeatApplicationId === schoolFinalId && c.item.roundId === finalXRoundId && c.item.roundType === 'FINAL_X'));

      // Bystander and original school coordinator do NOT see the students' Final X eligibility
      const bystanderElig = await app.inject({ method: 'GET', url: '/api/applications/final-eligibility', headers: { cookie: bystanderCookie } });
      assert.deepEqual(bystanderElig.json().choices, []);
      const coordElig = await app.inject({ method: 'GET', url: '/api/applications/final-eligibility', headers: { cookie: coordCookie } });
      assert.deepEqual(coordElig.json().choices, []);

      // Bystander and coordinator are rejected with 403 if they try to submit Final X for these applications
      const finalXPayload = (applicant, sourceFinalId) => ({
        applicant,
        items: [{ roundId: finalXRoundId, gradeId, format: 'paper', centerId, packageCode: 'onsite_ceremony', shirtSize: 'L', guests: [] }],
        pastPaperIds: [],
        sourceHeatApplicationId: sourceFinalId,
        source: 'final',
        slip,
        certificatePhoto,
      });
      assert.equal((await app.inject({ method: 'POST', url: '/api/applications/submit', headers: { cookie: bystanderCookie }, payload: finalXPayload(selfApplicant, selfFinalId) })).statusCode, 403);
      assert.equal((await app.inject({ method: 'POST', url: '/api/applications/submit', headers: { cookie: coordCookie }, payload: finalXPayload(schoolApplicant, schoolFinalId) })).statusCode, 403);

      // Both owners successfully submit Final X via API, and duplicate claim is rejected
      const selfFinalX = await app.inject({ method: 'POST', url: '/api/applications/submit', headers: { cookie: selfCookie }, payload: finalXPayload(selfApplicant, selfFinalId) });
      assert.equal(selfFinalX.statusCode, 201, selfFinalX.body);
      const dupSelfFinalX = await app.inject({ method: 'POST', url: '/api/applications/submit', headers: { cookie: selfCookie }, payload: finalXPayload(selfApplicant, selfFinalId) });
      assert.ok([403, 409].includes(dupSelfFinalX.statusCode));

      const schoolFinalX = await app.inject({ method: 'POST', url: '/api/applications/submit', headers: { cookie: schoolStudentCookie }, payload: finalXPayload(schoolApplicant, schoolFinalId) });
      assert.equal(schoolFinalX.statusCode, 201, schoolFinalX.body);
      const dupSchoolFinalX = await app.inject({ method: 'POST', url: '/api/applications/submit', headers: { cookie: schoolStudentCookie }, payload: finalXPayload(schoolApplicant, schoolFinalId) });
      assert.ok([403, 409].includes(dupSchoolFinalX.statusCode));
    } finally {
      globalThis.fetch = originalFetch;
      await db.query("DELETE FROM google_workspace_connection WHERE account_email='workspace@ocec.test'");
      if (previousAdmins === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = previousAdmins;
    }
  });
  test.after(async () => { await app.close(); await getPool().end(); });
}
