import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { app } from '../server/index.js';
import { createIndividualDraft, createSchoolDraft, downloadCertificatePhoto, getPublicApplicationForEdit, listMyApplications, removeCertificatePhoto, submitIndividualApplication, uploadCertificatePhoto } from '../server/applications.js';
import { getPool } from '../server/db.js';
import { bindFinalGrantToUser, createFinalVerificationGrant, finalGrantHash, listFinalEligibilityForUser } from '../server/finalEligibility.js';
import { seed } from '../server/seed.js';
import { installMockGoogleWorkspace } from './e2e/google-workspace-mock.js';

const testUrl = process.env.TEST_DATABASE_URL;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const photoPayload = { fileName: 'cert.png', mimeType: 'image/png', dataBase64: png.toString('base64') };

if (!testUrl) {
  test('OCEC-12 access policy tests require a disposable database', { skip: 'Use npm run test:db' }, () => {});
} else {
  const target = new URL(testUrl);
  if (!['localhost', '127.0.0.1', '::1'].includes(target.hostname) || !target.pathname.includes('test') || process.env.DATABASE_URL !== testUrl) {
    throw new Error('Use a disposable local test database');
  }
  app.log.level = 'silent';
  const runId = randomBytes(5).toString('hex');

  async function createUser(tag, { email = `${tag}-${runId}@example.test`, isAdmin = false } = {}) {
    const row = (await getPool().query(
      'INSERT INTO users(google_sub,email,display_name,is_admin) VALUES($1,$2,$3,$4) RETURNING id,email',
      [`sub-${tag}-${runId}`, email, `User ${tag}`, isAdmin],
    )).rows[0];
    const token = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
    await getPool().query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')", [createHash('sha256').update(token).digest('hex'), row.id]);
    return { id: row.id, email: row.email, cookie: `ocec_session=${token}` };
  }

  test.before(async () => {
    await seed();
  });

  test.after(async () => {
    await getPool().query("DELETE FROM google_workspace_connection WHERE account_email='workspace@ocec.test'").catch(() => {});
    await app.close();
    await getPool().end();
  });

  test('account view, photos, and shirt sizes enforce owner/admin policy strictly while Final verification grants stay scoped to Final flow (BR-04/BR-14/BR-15)', async () => {
    const db = getPool();
    const sharedEmail = `shared-contact-${runId}@example.test`;
    const newEmail = `changed-contact-${runId}@example.test`;

    const ownerUser = await createUser('owner');
    const sameEmailUser = await createUser('same-email', { email: sharedEmail });
    const changedEmailUser = await createUser('changed-email', { email: newEmail });
    const schoolCoordA = await createUser('coord-a');
    const schoolCoordB = await createUser('coord-b', { email: `coord-b-${runId}@example.test` });
    const studentSelf = await createUser('student-self');
    const studentExpired = await createUser('student-expired');
    const adminUser = await createUser('admin', { email: `admin-access-${runId}@example.test`, isAdmin: true });
    process.env.ADMIN_EMAILS = adminUser.email;

    const gradeId = (await db.query("SELECT id FROM grade_catalog WHERE label='Primary 1'")).rows[0].id;
    const centerId = (await db.query("SELECT id FROM exam_centers WHERE code='554'")).rows[0].id;
    const heatRoundId = `oc12-heat-${runId}`;
    const finalRoundId = `oc12-final-${runId}`;
    await db.query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date,exam_date,edit_close_date,is_open,active)
      VALUES
        ($1,'timo','TIMO Heat Access','2569','HEAT',current_date-1,current_date+1,current_date+10,current_date+15,true,true),
        ($2,'timo','TIMO Final Access','2569','FINAL',current_date-1,current_date+1,current_date+20,current_date+25,true,true)`,
    [heatRoundId, finalRoundId]);
    await db.query('INSERT INTO exam_round_grades(exam_round_id,grade_id) VALUES($1,$3),($2,$3)', [heatRoundId, finalRoundId, gradeId]);
    await db.query('INSERT INTO exam_round_centers(exam_round_id,center_id) VALUES($1,$3),($2,$3)', [heatRoundId, finalRoundId, centerId]);

    // 1) Draft isolation & shared contact_email never grants access
    const draftApp = await createIndividualDraft({
      applicant: { firstNameEn: `Draft${runId}`, middleNameEn: '', lastNameEn: 'Child', dateOfBirth: '2017-01-01', schoolName: 'Owner School', contactEmail: sharedEmail, contactPhone: '0811112222' },
      items: [{ roundId: heatRoundId, gradeId, format: 'paper', centerId }],
      pastPaperIds: [],
    }, ownerUser.id);
    assert.ok((await listMyApplications(ownerUser.id, ownerUser.email)).some((a) => a.id === draftApp.id));
    assert.ok(!(await listMyApplications(sameEmailUser.id, sameEmailUser.email)).some((a) => a.id === draftApp.id));

    // 2) Owner Final application with shared contact_email & later changed contact_email
    const finalApplicant = (await db.query(`INSERT INTO applicants(first_name_en,last_name_en,date_of_birth,school_name,contact_email,contact_phone)
      VALUES($1,'FinalChild','2016-04-04','Owner School',$2,'0812223333') RETURNING id`, [`OwnFinal${runId}`, sharedEmail])).rows[0].id;
    const finalAppId = (await db.query(`INSERT INTO applications(applicant_id,owner_user_id,source,status,registration_total_satang)
      VALUES($1,$2,'final','approved',0) RETURNING id`, [finalApplicant, ownerUser.id])).rows[0].id;
    const finalItemId = (await db.query(`INSERT INTO application_items(application_id,exam_round_id,grade_id,format,center_id,fee_satang,snapshot,duplicate_key,exam_number)
      VALUES($1,$2,$3,'paper',$4,0,'{}',$5,'FIN100') RETURNING id`, [finalAppId, finalRoundId, gradeId, centerId, randomUUID()])).rows[0].id;

    const originalFetch = globalThis.fetch;
    try {
      await installMockGoogleWorkspace();

      // Owner & admin allowed; sameEmailUser forbidden across view, photo, and shirt sizes
      assert.ok((await listMyApplications(ownerUser.id)).some((a) => a.id === finalAppId));
      assert.ok(!(await listMyApplications(sameEmailUser.id, sameEmailUser.email)).some((a) => a.id === finalAppId));
      await uploadCertificatePhoto(finalAppId, photoPayload, ownerUser.id, ownerUser.email, false);
      await assert.rejects(uploadCertificatePhoto(finalAppId, photoPayload, sameEmailUser.id, sameEmailUser.email, false), { statusCode: 403 });
      await assert.rejects(downloadCertificatePhoto(finalItemId, sameEmailUser.id, sameEmailUser.email, false), { statusCode: 403 });
      assert.ok((await downloadCertificatePhoto(finalItemId, ownerUser.id, ownerUser.email, false)).content.length > 0);
      assert.ok((await downloadCertificatePhoto(finalItemId, adminUser.id, adminUser.email, true)).content.length > 0);
      assert.equal((await app.inject({ method: 'PUT', url: `/api/applications/${finalAppId}/shirt-sizes`, headers: { cookie: sameEmailUser.cookie }, payload: { items: [{ applicationItemId: finalItemId, shirtSize: 'M' }] } })).statusCode, 403);
      assert.equal((await app.inject({ method: 'PUT', url: `/api/applications/${finalAppId}/shirt-sizes`, headers: { cookie: ownerUser.cookie }, payload: { items: [{ applicationItemId: finalItemId, shirtSize: 'M' }] } })).statusCode, 200);
      assert.equal((await app.inject({ method: 'PUT', url: `/api/applications/${finalAppId}/shirt-sizes`, headers: { cookie: adminUser.cookie }, payload: { items: [{ applicationItemId: finalItemId, shirtSize: 'L' }] } })).statusCode, 200);

      // Changing contact_email does not grant access to changedEmailUser or revoke ownerUser
      await db.query('UPDATE applicants SET contact_email=$1 WHERE id=$2', [newEmail, finalApplicant]);
      assert.ok(!(await listMyApplications(changedEmailUser.id, changedEmailUser.email)).some((a) => a.id === finalAppId));
      await assert.rejects(uploadCertificatePhoto(finalAppId, photoPayload, changedEmailUser.id, changedEmailUser.email, false), { statusCode: 403 });
      assert.equal((await app.inject({ method: 'PUT', url: `/api/applications/${finalAppId}/shirt-sizes`, headers: { cookie: changedEmailUser.cookie }, payload: { items: [{ applicationItemId: finalItemId, shirtSize: 'S' }] } })).statusCode, 403);

      // 3) School batch with 3 students sharing phone/email across different school coordinators
      const schoolBatch = await createSchoolDraft({
        schoolName: 'School Alpha',
        source: 'manual',
        applicants: [
          {
            applicant: { firstNameEn: `Alpha${runId}`, middleNameEn: '', lastNameEn: 'SelfClaim', dateOfBirth: '2016-06-06', schoolName: 'School Alpha', contactEmail: schoolCoordB.email, contactPhone: '0895556666' },
            items: [{ roundId: heatRoundId, gradeId, format: 'paper', centerId }],
            pastPaperIds: [],
          },
          {
            applicant: { firstNameEn: `Alpha${runId}`, middleNameEn: '', lastNameEn: 'TeacherProxy', dateOfBirth: '2016-07-07', schoolName: 'School Alpha', contactEmail: `stu2-${runId}@example.test`, contactPhone: '0895556666' },
            items: [{ roundId: heatRoundId, gradeId, format: 'paper', centerId }],
            pastPaperIds: [],
          },
          {
            applicant: { firstNameEn: `Alpha${runId}`, middleNameEn: '', lastNameEn: 'ExpiredGrant', dateOfBirth: '2016-08-08', schoolName: 'School Alpha', contactEmail: studentExpired.email, contactPhone: '0895556666' },
            items: [{ roundId: heatRoundId, gradeId, format: 'paper', centerId }],
            pastPaperIds: [],
          },
        ],
      }, schoolCoordA.id, schoolCoordA.email);
      const [schoolApp1Id, schoolApp2Id, schoolApp3Id] = schoolBatch.applicationIds;
      await db.query("UPDATE applications SET status='approved' WHERE school_batch_id=$1", [schoolBatch.id]);
      const schoolItems = (await db.query('SELECT id,application_id FROM application_items WHERE application_id=ANY($1::uuid[])', [schoolBatch.applicationIds])).rows;
      for (const row of schoolItems) {
        await db.query('UPDATE application_items SET exam_number=$1 WHERE id=$2', [`554${row.id.slice(0, 4)}`, row.id]);
        await db.query("INSERT INTO results(application_item_id,award,eligible_for_final,published_at) VALUES($1,'GOLD AWARD',true,now())", [row.id]);
        await db.query('INSERT INTO final_invitations(heat_application_item_id,final_exam_round_id) VALUES($1,$2)', [row.id, finalRoundId]);
      }
      await db.query('UPDATE exam_rounds SET close_date=current_date-1 WHERE id=$1', [heatRoundId]);
      // Owner uploads Heat photo on schoolApp1 so download can also be tested
      await uploadCertificatePhoto(schoolApp1Id, photoPayload, schoolCoordA.id, schoolCoordA.email, false);
      const schoolItem1Id = schoolItems.find((row) => row.application_id === schoolApp1Id).id;

      // Different school coordinator cannot access coordA's batch even with matching student email
      assert.ok(!(await listMyApplications(schoolCoordB.id, schoolCoordB.email)).some((a) => a.id === schoolApp1Id));
      await assert.rejects(uploadCertificatePhoto(schoolApp1Id, photoPayload, schoolCoordB.id, schoolCoordB.email, false), { statusCode: 403 });
      await assert.rejects(downloadCertificatePhoto(schoolItem1Id, schoolCoordB.id, schoolCoordB.email, false), { statusCode: 403 });

      // 4) BR-04 / BR-14 public edit access still works via name + phoneLast4
      const publicEdit = await getPublicApplicationForEdit(`Alpha${runId} SelfClaim`, '6666');
      assert.equal(publicEdit.id, schoolApp1Id);

      // 5) Starting Final verification (live bound grant, NOT yet submitted Final) MUST NOT open Heat view or Heat photo management!
      const grantToken = await createFinalVerificationGrant({ candidateName: `Alpha${runId} SelfClaim`, finalRoundId, phoneLast4: '6666' });
      const grantId = (await db.query('SELECT id FROM final_verification_grants WHERE token_hash=$1', [finalGrantHash(grantToken)])).rows[0].id;
      await bindFinalGrantToUser(grantId, studentSelf.id);

      // Final eligibility flow DOES work for this exact invitation within TTL
      const eligibleChoices = await listFinalEligibilityForUser(studentSelf.id, grantToken);
      assert.equal(eligibleChoices.length, 1);
      assert.equal(eligibleChoices[0].sourceHeatApplicationId, schoolApp1Id);

      // Account portal MUST NOT expose the Heat application or allow Heat photo upload/download/remove!
      assert.ok(!(await listMyApplications(studentSelf.id)).some((a) => a.id === schoolApp1Id), 'verified-only Final grant must not expose Heat app in My Applications');
      await assert.rejects(uploadCertificatePhoto(schoolApp1Id, photoPayload, studentSelf.id, studentSelf.email, false), { statusCode: 403 });
      await assert.rejects(downloadCertificatePhoto(schoolItem1Id, studentSelf.id, studentSelf.email, false), { statusCode: 403 });
      await assert.rejects(removeCertificatePhoto(schoolApp1Id, studentSelf.id, studentSelf.email, false), { statusCode: 403 });

      // 6) Student submits Final via BR-04/BR-14 -> Final belongs to studentSelf (student owns & manages Final view/photo/shirt), Heat remains owned by schoolCoordA
      const studentFinal = await submitIndividualApplication({
        applicant: { firstNameEn: `Alpha${runId}`, middleNameEn: '', lastNameEn: 'SelfClaim', dateOfBirth: '2016-06-06', schoolName: 'School Alpha', contactEmail: schoolCoordB.email, contactPhone: '0895556666' },
        items: [{ roundId: finalRoundId, gradeId, format: 'paper', centerId, packageCode: 'onsite', shirtSize: 'M', guests: [] }],
        pastPaperIds: [],
        sourceHeatApplicationId: schoolApp1Id,
        source: 'final',
        slip: photoPayload,
        certificatePhoto: photoPayload,
      }, studentSelf.id, grantToken);
      const studentFinalItemId = (await db.query('SELECT id FROM application_items WHERE application_id=$1', [studentFinal.id])).rows[0].id;
      assert.ok((await listMyApplications(studentSelf.id)).some((a) => a.id === studentFinal.id), 'student owns submitted Final app');
      assert.ok(!(await listMyApplications(studentSelf.id)).some((a) => a.id === schoolApp1Id), 'Heat stays with original owner pending BR-OPEN-05');
      assert.equal((await app.inject({ method: 'PUT', url: `/api/applications/${studentFinal.id}/shirt-sizes`, headers: { cookie: studentSelf.cookie }, payload: { items: [{ applicationItemId: studentFinalItemId, shirtSize: 'L' }] } })).statusCode, 200);
      assert.ok((await downloadCertificatePhoto(studentFinalItemId, studentSelf.id, studentSelf.email, false)).content.length > 0);
      // Original coordinator still owns Heat, does NOT own student's Final
      assert.ok((await listMyApplications(schoolCoordA.id)).some((a) => a.id === schoolApp1Id));
      assert.ok(!(await listMyApplications(schoolCoordA.id)).some((a) => a.id === studentFinal.id));

      // 7) Expired Final grant cannot list Final eligibility, cannot submit Final, and cannot access Heat view/photo!
      const expiredToken = await createFinalVerificationGrant({ candidateName: `Alpha${runId} ExpiredGrant`, finalRoundId, phoneLast4: '6666' });
      const expiredGrantId = (await db.query('SELECT id FROM final_verification_grants WHERE token_hash=$1', [finalGrantHash(expiredToken)])).rows[0].id;
      await bindFinalGrantToUser(expiredGrantId, studentExpired.id);
      await db.query("UPDATE final_verification_grants SET expires_at = now() - interval '1 minute' WHERE id=$1", [expiredGrantId]);

      assert.deepEqual(await listFinalEligibilityForUser(studentExpired.id, expiredToken), []);
      assert.ok(!(await listMyApplications(studentExpired.id, studentExpired.email)).some((a) => a.id === schoolApp3Id));
      await assert.rejects(uploadCertificatePhoto(schoolApp3Id, photoPayload, studentExpired.id, studentExpired.email, false), { statusCode: 403 });
      await assert.rejects(submitIndividualApplication({
        applicant: { firstNameEn: `Alpha${runId}`, middleNameEn: '', lastNameEn: 'ExpiredGrant', dateOfBirth: '2016-08-08', schoolName: 'School Alpha', contactEmail: studentExpired.email, contactPhone: '0895556666' },
        items: [{ roundId: finalRoundId, gradeId, format: 'paper', centerId, packageCode: 'onsite', shirtSize: 'S', guests: [] }],
        pastPaperIds: [],
        sourceHeatApplicationId: schoolApp3Id,
        source: 'final',
        slip: photoPayload,
        certificatePhoto: photoPayload,
      }, studentExpired.id, expiredToken), { statusCode: 403 });

      // 8) Teacher proxy claim -> Final belongs to teacher (schoolCoordA), Heat stays with teacher
      const teacherGrantToken = await createFinalVerificationGrant({ candidateName: `Alpha${runId} TeacherProxy`, finalRoundId, phoneLast4: '6666' });
      const teacherGrantId = (await db.query('SELECT id FROM final_verification_grants WHERE token_hash=$1', [finalGrantHash(teacherGrantToken)])).rows[0].id;
      await bindFinalGrantToUser(teacherGrantId, schoolCoordA.id);
      const teacherFinal = await submitIndividualApplication({
        applicant: { firstNameEn: `Alpha${runId}`, middleNameEn: '', lastNameEn: 'TeacherProxy', dateOfBirth: '2016-07-07', schoolName: 'School Alpha', contactEmail: `stu2-${runId}@example.test`, contactPhone: '0895556666' },
        items: [{ roundId: finalRoundId, gradeId, format: 'paper', centerId, packageCode: 'onsite', shirtSize: 'S', guests: [] }],
        pastPaperIds: [],
        sourceHeatApplicationId: schoolApp2Id,
        source: 'final',
        slip: photoPayload,
        certificatePhoto: photoPayload,
      }, schoolCoordA.id, teacherGrantToken);
      assert.ok((await listMyApplications(schoolCoordA.id)).some((a) => a.id === teacherFinal.id));
      assert.ok((await listMyApplications(schoolCoordA.id)).some((a) => a.id === schoolApp2Id));
      assert.ok(!(await listMyApplications(studentSelf.id)).some((a) => a.id === teacherFinal.id));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}
