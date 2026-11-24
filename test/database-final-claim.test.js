import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { app } from '../server/index.js';
import { createIndividualDraft, createSchoolDraft, getPublicApplicationForEdit, submitIndividualApplication } from '../server/applications.js';
import { getPool } from '../server/db.js';
import { bindFinalGrantToUser, createFinalVerificationGrant, finalGrantHash, listFinalEligibilityForUser, searchSchoolFinalEligibility } from '../server/finalEligibility.js';
import { seed } from '../server/seed.js';
import { installMockGoogleWorkspace } from './e2e/google-workspace-mock.js';

const runId = randomBytes(5).toString('hex');
const databaseUrl = process.env.TEST_DATABASE_URL;

if (!databaseUrl) {
  test('Final database workflow requires a disposable test database', { skip: 'Use npm run test:db' }, () => {});
} else {
  app.log.level = 'silent';
  const name = `Claim${runId} Student`;
  const phone = '0812345678';
  const firstRoundId = `bbb-final-claim-${runId}`;
  const secondRoundId = `bbb-final-extra-${runId}`;
  let coordinatorId;
  let applicantId;
  let heatApplicationId;
  let gradeId;
  let centerId;
  let token;

  test.before(async () => {
    await seed();
    const users = await getPool().query(`INSERT INTO users(google_sub,email,display_name)
      VALUES($1,$2,'Test Coordinator'),($3,$4,'Test Applicant') RETURNING id`,
    [`school-${runId}`, `school-${runId}@example.test`, `applicant-${runId}`, `applicant-${runId}@example.test`]);
    [coordinatorId, applicantId] = users.rows.map((row) => row.id);
    gradeId = (await getPool().query("SELECT id FROM grade_catalog WHERE label='Primary 1'")).rows[0].id;
    centerId = (await getPool().query("SELECT id FROM exam_centers WHERE code='554'")).rows[0].id;
    const draft = await createSchoolDraft({ schoolName: 'Claim School', source: 'manual', applicants: [{
      applicant: { firstNameEn: `Claim${runId}`, middleNameEn: '', lastNameEn: 'Student', dateOfBirth: '2017-01-01', schoolName: 'Claim School', contactEmail: `child-${runId}@example.test`, contactPhone: phone },
      items: [{ roundId: 'bbb-heat-2569', gradeId, format: 'paper', centerId }], pastPaperIds: [],
    }] }, coordinatorId, `school-${runId}@example.test`);
    heatApplicationId = draft.applicationIds[0];
    const heatItem = (await getPool().query('SELECT id FROM application_items WHERE application_id=$1', [heatApplicationId])).rows[0].id;
    for (const roundId of [firstRoundId, secondRoundId]) {
      await getPool().query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date,exam_date,is_open,active)
        VALUES($1,'bbb','Big Bay Bei (BBB)','2569','FINAL',(now() AT TIME ZONE 'Asia/Bangkok')::date-1,(now() AT TIME ZONE 'Asia/Bangkok')::date+1,(now() AT TIME ZONE 'Asia/Bangkok')::date+20,true,true)`, [roundId]);
      await getPool().query('INSERT INTO exam_round_grades(exam_round_id,grade_id) VALUES($1,$2)', [roundId, gradeId]);
      await getPool().query('INSERT INTO exam_round_centers(exam_round_id,center_id) VALUES($1,$2)', [roundId, centerId]);
      await getPool().query('INSERT INTO final_invitations(heat_application_item_id,final_exam_round_id) VALUES($1,$2)', [heatItem, roundId]);
    }
    await getPool().query("INSERT INTO results(application_item_id,award,eligible_for_final,published_at) VALUES($1,'1ST AWARD',true,now())", [heatItem]);
  });
  test.after(async () => { await app.close(); await getPool().end(); });

  test('search returns only published eligible school exam choices', async () => {
    const choices = await searchSchoolFinalEligibility(name);
    assert.deepEqual(choices.map((choice) => choice.finalRoundId).sort(), [firstRoundId, secondRoundId].sort());
    assert.ok(choices.every((choice) => !('schoolName' in choice) && !('candidateName' in choice) && !('phone' in choice)));
    assert.deepEqual(await searchSchoolFinalEligibility('Unknown Student'), []);
  });

  test('filters unavailable and ineligible Heat results', async () => {
    const pool = getPool();
    const heatItem = (await pool.query('SELECT id FROM application_items WHERE application_id=$1', [heatApplicationId])).rows[0].id;
    await pool.query('UPDATE results SET published_at=NULL WHERE application_item_id=$1', [heatItem]);
    try { assert.deepEqual(await searchSchoolFinalEligibility(name), []); }
    finally { await pool.query('UPDATE results SET published_at=now() WHERE application_item_id=$1', [heatItem]); }
    await pool.query('UPDATE results SET eligible_for_final=false WHERE application_item_id=$1', [heatItem]);
    try { assert.deepEqual(await searchSchoolFinalEligibility(name), []); }
    finally { await pool.query('UPDATE results SET eligible_for_final=true WHERE application_item_id=$1', [heatItem]); }
    await pool.query('UPDATE exam_rounds SET final_manually_closed=true WHERE id=$1', [firstRoundId]);
    try { assert.deepEqual((await searchSchoolFinalEligibility(name)).map((choice) => choice.finalRoundId), [secondRoundId]); }
    finally { await pool.query('UPDATE exam_rounds SET final_manually_closed=false WHERE id=$1', [firstRoundId]); }
  });

  test('verification is generic, no-store, and limited to the selected invitation', async () => {
    await assert.rejects(createFinalVerificationGrant({ candidateName: name, finalRoundId: firstRoundId, phoneLast4: '0000' }), { statusCode: 403 });
    const search = await app.inject({ method: 'POST', url: '/api/public/final-eligibility/search', payload: { candidateName: name } });
    assert.equal(search.statusCode, 200, search.body);
    assert.equal(search.headers['cache-control'], 'no-store');
    const verify = await app.inject({ method: 'POST', url: '/api/public/final-eligibility/verify', payload: { candidateName: name, finalRoundId: firstRoundId, phoneLast4: '5678' } });
    assert.equal(verify.statusCode, 200, verify.body);
    assert.equal(verify.headers['cache-control'], 'no-store');
    assert.match(verify.headers['set-cookie'], /HttpOnly; SameSite=Lax; Max-Age=600/);
    token = verify.headers['set-cookie'].match(/ocec_final_verification=([^;]+)/)[1];
    const stored = await getPool().query('SELECT token_hash,final_invitation_id FROM final_verification_grants WHERE heat_application_id=$1', [heatApplicationId]);
    assert.equal(stored.rowCount, 1);
    assert.notEqual(stored.rows[0].token_hash, token);
  });

  test('OAuth state nonce expiry and replay cannot bind the grant', async () => {
    const grantCookie = `ocec_final_verification=${token}`;
    const start = await app.inject({ method: 'GET', url: '/api/auth/google/start?flow=final&returnTo=/final/confirm&testPersona=candidate', headers: { cookie: grantCookie } });
    assert.equal(start.statusCode, 302, start.body);
    const stateCookie = start.headers['set-cookie'].split(';')[0];
    const callback = new URL(start.headers.location);
    const valid = await app.inject({ method: 'GET', url: `${callback.pathname}${callback.search}`, headers: { cookie: `${grantCookie}; ${stateCookie}` } });
    assert.equal(valid.statusCode, 302, valid.body);
    const replay = await app.inject({ method: 'GET', url: `${callback.pathname}${callback.search}`, headers: { cookie: `${grantCookie}; ${stateCookie}` } });
    assert.equal(replay.statusCode, 400);
    const user = (await getPool().query('SELECT verified_user_id FROM final_verification_grants WHERE heat_application_id=$1', [heatApplicationId])).rows[0];
    assert.ok(user.verified_user_id);
  });

  test('school grant cannot claim a different invitation from the same Heat application', async () => {
    const choices = await listFinalEligibilityForUser(applicantId, token);
    assert.deepEqual(choices, []);
    const verifiedUserId = (await getPool().query('SELECT verified_user_id FROM final_verification_grants WHERE heat_application_id=$1', [heatApplicationId])).rows[0].verified_user_id;
    const authorized = await listFinalEligibilityForUser(verifiedUserId, token);
    assert.equal(authorized.length, 1);
    assert.equal(authorized[0].item.roundId, firstRoundId);
    const candidate = (roundId) => ({
      source: 'final', sourceHeatApplicationId: heatApplicationId,
      applicant: { firstNameEn: `Claim${runId}`, lastNameEn: 'Student', dateOfBirth: '2017-01-01', schoolName: 'Claim School', contactEmail: `child-${runId}@example.test`, contactPhone: phone },
      items: [{ roundId, gradeId, format: 'paper', centerId }], pastPaperIds: [],
    });
    await assert.rejects(createIndividualDraft(candidate(secondRoundId), verifiedUserId, token), { statusCode: 403 });
    const draft = await createIndividualDraft(candidate(firstRoundId), verifiedUserId, token);
    const owners = await getPool().query('SELECT owner_user_id,source_heat_application_id FROM applications WHERE id=$1', [draft.id]);
    assert.equal(owners.rows[0].owner_user_id, verifiedUserId);
    assert.equal(owners.rows[0].source_heat_application_id, heatApplicationId);
    assert.notEqual(owners.rows[0].owner_user_id, coordinatorId);
  });

  test('expired or invalid OAuth continuation cannot claim a grant', async () => {
    const fresh = await createFinalVerificationGrant({ candidateName: name, finalRoundId: secondRoundId, phoneLast4: '5678' });
    const grantCookie = `ocec_final_verification=${fresh}`;
    const start = await app.inject({ method: 'GET', url: '/api/auth/google/start?flow=final&returnTo=/final/confirm&testPersona=candidate&testNonce=wrong', headers: { cookie: grantCookie } });
    assert.equal(start.statusCode, 302);
    const stateCookie = start.headers['set-cookie'].split(';')[0];
    const callback = new URL(start.headers.location);
    const wrongNonce = await app.inject({ method: 'GET', url: `${callback.pathname}${callback.search}`, headers: { cookie: `${grantCookie}; ${stateCookie}` } });
    assert.equal(wrongNonce.statusCode, 403);
    const grant = await getPool().query('SELECT id,verified_user_id FROM final_verification_grants WHERE token_hash=$1', [finalGrantHash(fresh)]);
    assert.equal(grant.rows[0].verified_user_id, null);
    await getPool().query("UPDATE final_verification_grants SET expires_at=now()-interval '1 second' WHERE id=$1", [grant.rows[0].id]);
    const expired = await app.inject({ method: 'GET', url: '/api/auth/google/start?flow=final&returnTo=/final/confirm&testPersona=candidate', headers: { cookie: grantCookie } });
    assert.equal(expired.statusCode, 403);
  });

  test('requires exam selection and refuses ambiguous same-name matches', async () => {
    await assert.rejects(createFinalVerificationGrant({ candidateName: name, phoneLast4: '5678' }), { statusCode: 403 });
    const duplicate = await createSchoolDraft({ schoolName: 'Another Claim School', source: 'manual', applicants: [{
      applicant: { firstNameEn: `Claim${runId}`, lastNameEn: 'Student', dateOfBirth: '2016-01-01', schoolName: 'Another Claim School', contactEmail: `other-child-${runId}@example.test`, contactPhone: phone },
      items: [{ roundId: 'bbb-heat-2569', gradeId, format: 'paper', centerId }], pastPaperIds: [],
    }] }, coordinatorId, `school-${runId}@example.test`);
    const heatItem = (await getPool().query('SELECT id FROM application_items WHERE application_id=$1', [duplicate.applicationIds[0]])).rows[0].id;
    await getPool().query("INSERT INTO results(application_item_id,award,eligible_for_final,published_at) VALUES($1,'1ST AWARD',true,now())", [heatItem]);
    await getPool().query('INSERT INTO final_invitations(heat_application_item_id,final_exam_round_id) VALUES($1,$2)', [heatItem, firstRoundId]);
    assert.equal((await searchSchoolFinalEligibility(name)).filter((choice) => choice.finalRoundId === firstRoundId).length, 1);
    await assert.rejects(createFinalVerificationGrant({ candidateName: name, finalRoundId: firstRoundId, phoneLast4: '5678' }), { statusCode: 403 });
  });

  test('verification is generic, no-store, and rate-limited', async () => {
    const payload = { candidateName: name, finalRoundId: secondRoundId, phoneLast4: '0000' };
    const unknown = await app.inject({ method: 'POST', url: '/api/public/final-eligibility/verify', payload: { ...payload, candidateName: 'Unknown Student' } });
    const incorrect = await app.inject({ method: 'POST', url: '/api/public/final-eligibility/verify', payload });
    assert.equal(unknown.statusCode, 403);
    assert.equal(incorrect.statusCode, 403);
    assert.deepEqual(unknown.json(), incorrect.json());
    assert.equal(unknown.headers['cache-control'], 'no-store');
    let limited;
    for (let index = 0; index < 35; index += 1) {
      limited = await app.inject({ method: 'POST', url: '/api/public/final-eligibility/verify', payload });
      if (limited.statusCode === 429) break;
    }
    assert.equal(limited.statusCode, 429);
    assert.equal(limited.headers['retry-after'], '900');
  });

  test('shared parent contact separates siblings under one account, supports student self-claim and teacher proxy claim without cross-applicant leakage, and blocks ambiguous or duplicate claims', async () => {
    const db = getPool();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const slip = { fileName: 'slip.png', mimeType: 'image/png', dataBase64: png.toString('base64') };
    const photo = { fileName: 'photo.png', mimeType: 'image/png', dataBase64: png.toString('base64') };

    const extraUsers = await db.query(`INSERT INTO users(google_sub,email,display_name) VALUES
      ($1,$2,'Shared Parent'),
      ($3,$4,'School Teacher'),
      ($5,$6,'Self Student')
      RETURNING id`, [
      `parent-${runId}`, `parent-${runId}@example.test`,
      `teacher-${runId}`, `teacher-${runId}@example.test`,
      `student-${runId}`, `student-${runId}@example.test`,
    ]);
    const [parentId, teacherId, studentSelfId] = extraUsers.rows.map((row) => row.id);
    const sharedHeatRoundId = `timo-heat-shared-${runId}`;
    const sharedFinalRoundId = `timo-final-shared-${runId}`;
    await db.query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date,exam_date,is_open,active)
      VALUES
        ($1,'timo','TIMO Heat Shared','2569','HEAT',(now() AT TIME ZONE 'Asia/Bangkok')::date-1,(now() AT TIME ZONE 'Asia/Bangkok')::date+1,(now() AT TIME ZONE 'Asia/Bangkok')::date+10,true,true),
        ($2,'timo','TIMO Final Shared','2569','FINAL',(now() AT TIME ZONE 'Asia/Bangkok')::date-1,(now() AT TIME ZONE 'Asia/Bangkok')::date+1,(now() AT TIME ZONE 'Asia/Bangkok')::date+20,true,true)`, [sharedHeatRoundId, sharedFinalRoundId]);
    await db.query('INSERT INTO exam_round_grades(exam_round_id,grade_id) VALUES($1,$3),($2,$3)', [sharedHeatRoundId, sharedFinalRoundId, gradeId]);
    await db.query('INSERT INTO exam_round_centers(exam_round_id,center_id) VALUES($1,$3),($2,$3)', [sharedHeatRoundId, sharedFinalRoundId, centerId]);

    const sharedParentEmail = `family-${runId}@example.test`;
    const sharedParentPhone = '0897778888';
    const sibling1 = { firstNameEn: `Alice${runId}`, middleNameEn: '', lastNameEn: 'Family', firstNameTh: 'อลิซ', lastNameTh: 'ครอบครัว', gender: 'Female', dateOfBirth: '2016-03-01', schoolName: 'Family School', contactEmail: sharedParentEmail, contactPhone: sharedParentPhone };
    const sibling2 = { firstNameEn: `Bob${runId}`, middleNameEn: '', lastNameEn: 'Family', firstNameTh: 'บ็อบ', lastNameTh: 'ครอบครัว', gender: 'Male', dateOfBirth: '2018-07-09', schoolName: 'Family School', contactEmail: sharedParentEmail, contactPhone: sharedParentPhone };

    const heatSib1 = await createIndividualDraft({ applicant: sibling1, items: [{ roundId: sharedHeatRoundId, gradeId, format: 'paper', centerId }], pastPaperIds: [] }, parentId);
    const heatSib2 = await createIndividualDraft({ applicant: sibling2, items: [{ roundId: sharedHeatRoundId, gradeId, format: 'paper', centerId }], pastPaperIds: [] }, parentId);
    await db.query("UPDATE applications SET status='approved' WHERE id=ANY($1::uuid[])", [[heatSib1.id, heatSib2.id]]);
    const sibItems = (await db.query('SELECT id,application_id FROM application_items WHERE application_id=ANY($1::uuid[])', [[heatSib1.id, heatSib2.id]])).rows;
    for (const row of sibItems) {
      await db.query("INSERT INTO results(application_item_id,award,eligible_for_final,published_at) VALUES($1,'GOLD AWARD',true,now())", [row.id]);
      await db.query('INSERT INTO final_invitations(heat_application_item_id,final_exam_round_id) VALUES($1,$2)', [row.id, sharedFinalRoundId]);
    }

    // Siblings sharing parent contact get separate public edit matches (by each child's name + shared phone last 4)
    const editSib1 = await getPublicApplicationForEdit(`${sibling1.firstNameEn} Family`, '8888');
    const editSib2 = await getPublicApplicationForEdit(`${sibling2.firstNameEn} Family`, '8888');
    assert.equal(editSib1.id, heatSib1.id);
    assert.equal(editSib2.id, heatSib2.id);

    // Parent sees BOTH siblings separately with zero cross-contamination of personal data
    const parentChoices = (await listFinalEligibilityForUser(parentId)).filter((c) => c.item.roundId === sharedFinalRoundId);
    assert.equal(parentChoices.length, 2);
    const choiceAlice = parentChoices.find((c) => c.sourceHeatApplicationId === heatSib1.id);
    const choiceBob = parentChoices.find((c) => c.sourceHeatApplicationId === heatSib2.id);
    assert.equal(choiceAlice.applicant.firstNameEn, sibling1.firstNameEn);
    assert.equal(choiceAlice.applicant.gender, 'Female');
    assert.equal(choiceBob.applicant.firstNameEn, sibling2.firstNameEn);
    assert.equal(choiceBob.applicant.gender, 'Male');

    // School batch with 2 students sharing the school's phone & email
    const sharedSchoolPhone = '0823334444';
    const sharedSchoolEmail = `teacher-shared-${runId}@example.test`;
    const stuSelf = { firstNameEn: `Suda${runId}`, middleNameEn: '', lastNameEn: 'Schooler', dateOfBirth: '2016-05-05', schoolName: 'Shared Contact School', contactEmail: sharedSchoolEmail, contactPhone: sharedSchoolPhone };
    const stuProxy = { firstNameEn: `Somchai${runId}`, middleNameEn: '', lastNameEn: 'Schooler', dateOfBirth: '2016-06-06', schoolName: 'Shared Contact School', contactEmail: sharedSchoolEmail, contactPhone: sharedSchoolPhone };
    const schoolBatch = await createSchoolDraft({
      schoolName: 'Shared Contact School',
      source: 'manual',
      applicants: [
        { applicant: stuSelf, items: [{ roundId: sharedHeatRoundId, gradeId, format: 'paper', centerId }], pastPaperIds: [] },
        { applicant: stuProxy, items: [{ roundId: sharedHeatRoundId, gradeId, format: 'paper', centerId }], pastPaperIds: [] },
      ],
    }, teacherId, sharedSchoolEmail);
    await db.query("UPDATE applications SET status='approved' WHERE school_batch_id=$1", [schoolBatch.id]);
    const schoolItems = (await db.query('SELECT id,application_id FROM application_items WHERE application_id=ANY($1::uuid[])', [schoolBatch.applicationIds])).rows;
    for (const row of schoolItems) {
      await db.query("INSERT INTO results(application_item_id,award,eligible_for_final,published_at) VALUES($1,'BRONZE AWARD',true,now())", [row.id]);
      await db.query('INSERT INTO final_invitations(heat_application_item_id,final_exam_round_id) VALUES($1,$2)', [row.id, sharedFinalRoundId]);
    }

    const originalFetch = globalThis.fetch;
    try {
      await installMockGoogleWorkspace();

      // 1) Parent submits Final for BOTH siblings in the same parent Google account (editing personal details & picking Final packages independently)
      const finalAlice = await submitIndividualApplication({
        applicant: { ...sibling1, firstNameTh: 'อลิซแก้ไข' },
        items: [{ roundId: sharedFinalRoundId, gradeId, format: 'paper', centerId, packageCode: 'onsite', shirtSize: 'S', guests: [] }],
        pastPaperIds: [],
        sourceHeatApplicationId: heatSib1.id,
        source: 'final',
        slip,
        certificatePhoto: photo,
      }, parentId);
      const finalBob = await submitIndividualApplication({
        applicant: { ...sibling2, firstNameTh: 'บ็อบแก้ไข' },
        items: [{ roundId: sharedFinalRoundId, gradeId, format: 'paper', centerId, packageCode: 'onsite_ceremony', shirtSize: 'M', guests: [] }],
        pastPaperIds: [],
        sourceHeatApplicationId: heatSib2.id,
        source: 'final',
        slip,
        certificatePhoto: photo,
      }, parentId);
      assert.notEqual(finalAlice.id, finalBob.id);
      assert.equal((await db.query('SELECT owner_user_id FROM applications WHERE id=$1', [finalAlice.id])).rows[0].owner_user_id, parentId);
      assert.equal((await db.query('SELECT owner_user_id FROM applications WHERE id=$1', [finalBob.id])).rows[0].owner_user_id, parentId);
      // Re-submitting Final from Alice's already-claimed invitation fails
      await assert.rejects(submitIndividualApplication({
        applicant: sibling1,
        items: [{ roundId: sharedFinalRoundId, gradeId, format: 'paper', centerId, packageCode: 'onsite', shirtSize: 'S', guests: [] }],
        pastPaperIds: [],
        sourceHeatApplicationId: heatSib1.id,
        source: 'final',
        slip,
        certificatePhoto: photo,
      }, parentId), (error) => [403, 409].includes(error.statusCode));

      // 2) School student self-claim -> Final belongs to student's Google account, Heat stays with teacher
      const selfToken = await createFinalVerificationGrant({ candidateName: `${stuSelf.firstNameEn} Schooler`, finalRoundId: sharedFinalRoundId, phoneLast4: '4444' });
      const selfGrantId = (await db.query('SELECT id FROM final_verification_grants WHERE token_hash=$1', [finalGrantHash(selfToken)])).rows[0].id;
      await bindFinalGrantToUser(selfGrantId, studentSelfId);
      const selfChoices = await listFinalEligibilityForUser(studentSelfId, selfToken);
      assert.equal(selfChoices.length, 1);
      assert.equal(selfChoices[0].applicant.firstNameEn, stuSelf.firstNameEn);
      const selfFinal = await submitIndividualApplication({
        applicant: stuSelf,
        items: [{ roundId: sharedFinalRoundId, gradeId, format: 'paper', centerId, packageCode: 'onsite', shirtSize: 'S', guests: [] }],
        pastPaperIds: [],
        sourceHeatApplicationId: schoolBatch.applicationIds[0],
        source: 'final',
        slip,
        certificatePhoto: photo,
      }, studentSelfId, selfToken);
      assert.equal((await db.query('SELECT owner_user_id FROM applications WHERE id=$1', [selfFinal.id])).rows[0].owner_user_id, studentSelfId);
      assert.equal((await db.query('SELECT owner_user_id FROM applications WHERE id=$1', [schoolBatch.applicationIds[0]])).rows[0].owner_user_id, teacherId);

      // 3) Teacher verifies & claims on behalf of Student 2 -> Final belongs to teacher's Google account, Heat stays with teacher
      const proxyToken = await createFinalVerificationGrant({ candidateName: `${stuProxy.firstNameEn} Schooler`, finalRoundId: sharedFinalRoundId, phoneLast4: '4444' });
      const proxyGrantId = (await db.query('SELECT id FROM final_verification_grants WHERE token_hash=$1', [finalGrantHash(proxyToken)])).rows[0].id;
      await bindFinalGrantToUser(proxyGrantId, teacherId);
      const proxyChoices = await listFinalEligibilityForUser(teacherId, proxyToken);
      assert.equal(proxyChoices.length, 1);
      assert.equal(proxyChoices[0].applicant.firstNameEn, stuProxy.firstNameEn);
      const proxyFinal = await submitIndividualApplication({
        applicant: stuProxy,
        items: [{ roundId: sharedFinalRoundId, gradeId, format: 'paper', centerId, packageCode: 'onsite_ceremony', shirtSize: 'L', guests: [] }],
        pastPaperIds: [],
        sourceHeatApplicationId: schoolBatch.applicationIds[1],
        source: 'final',
        slip,
        certificatePhoto: photo,
      }, teacherId, proxyToken);
      assert.equal((await db.query('SELECT owner_user_id FROM applications WHERE id=$1', [proxyFinal.id])).rows[0].owner_user_id, teacherId);
      assert.equal((await db.query('SELECT owner_user_id FROM applications WHERE id=$1', [schoolBatch.applicationIds[1]])).rows[0].owner_user_id, teacherId);

      // 4) Duplicate claim for Student 2 fails
      await assert.rejects(submitIndividualApplication({
        applicant: stuProxy,
        items: [{ roundId: sharedFinalRoundId, gradeId, format: 'paper', centerId, packageCode: 'onsite', shirtSize: 'L', guests: [] }],
        pastPaperIds: [],
        sourceHeatApplicationId: schoolBatch.applicationIds[1],
        source: 'final',
        slip,
        certificatePhoto: photo,
      }, teacherId, proxyToken), (error) => [403, 409].includes(error.statusCode));

      // 5) Ambiguous public edit (two applications with identical English name + phone last 4) stops with 409 and tells user to contact staff
      const dupNameApplicant = { firstNameEn: `Twin${runId}`, middleNameEn: '', lastNameEn: 'Same', dateOfBirth: '2016-01-01', schoolName: 'School One', contactEmail: `twin1-${runId}@example.test`, contactPhone: '0859991234' };
      const dupNameApp1 = await createIndividualDraft({ applicant: dupNameApplicant, items: [{ roundId: sharedHeatRoundId, gradeId, format: 'paper', centerId }], pastPaperIds: [] }, parentId);
      const dupNameApp2 = await createIndividualDraft({ applicant: { ...dupNameApplicant, dateOfBirth: '2015-01-01', schoolName: 'School Two' }, items: [{ roundId: sharedHeatRoundId, gradeId, format: 'paper', centerId }], pastPaperIds: [] }, parentId);
      await db.query("UPDATE applications SET status='approved' WHERE id=ANY($1::uuid[])", [[dupNameApp1.id, dupNameApp2.id]]);
      await assert.rejects(
        getPublicApplicationForEdit(`${dupNameApplicant.firstNameEn} Same`, '1234'),
        (error) => error.statusCode === 409 && /ติดต่อเจ้าหน้าที่/.test(error.message),
      );
    } finally {
      globalThis.fetch = originalFetch;
      await db.query("DELETE FROM google_workspace_connection WHERE account_email='workspace@ocec.test'");
    }
  });
}
