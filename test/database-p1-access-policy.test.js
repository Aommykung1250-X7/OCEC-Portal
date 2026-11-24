import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { app } from '../server/index.js';
import { createIndividualDraft, createSchoolDraft, downloadCertificatePhoto, getPublicApplicationForEdit, listMyApplications, removeCertificatePhoto, submitIndividualApplication, uploadCertificatePhoto } from '../server/applications.js';
import { getPool } from '../server/db.js';
import { bindFinalGrantToUser, createFinalVerificationGrant, finalGrantHash } from '../server/finalEligibility.js';
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

  test('shared or changed contact_email never grants account access, photo access, shirt access, or draft visibility; owner, verified delegation, and admin are enforced consistently', async () => {
    const db = getPool();
    const sharedEmail = `shared-contact-${runId}@example.test`;
    const newEmail = `changed-contact-${runId}@example.test`;

    const ownerUser = await createUser('owner');
    const sameEmailUser = await createUser('same-email', { email: sharedEmail });
    const changedEmailUser = await createUser('changed-email', { email: newEmail });
    const schoolCoordA = await createUser('coord-a');
    const schoolCoordB = await createUser('coord-b', { email: `coord-b-${runId}@example.test` });
    const studentSelf = await createUser('student-self');
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

    // 1) Owner creates a DRAFT whose contact_email matches sameEmailUser
    const draftApp = await createIndividualDraft({
      applicant: { firstNameEn: `Draft${runId}`, middleNameEn: '', lastNameEn: 'Child', dateOfBirth: '2017-01-01', schoolName: 'Owner School', contactEmail: sharedEmail, contactPhone: '0811112222' },
      items: [{ roundId: heatRoundId, gradeId, format: 'paper', centerId }],
      pastPaperIds: [],
    }, ownerUser.id);

    // Owner sees their own draft; sameEmailUser does NOT see it even though contact_email matches
    assert.ok((await listMyApplications(ownerUser.id, ownerUser.email)).some((a) => a.id === draftApp.id));
    assert.ok(!(await listMyApplications(sameEmailUser.id, sameEmailUser.email)).some((a) => a.id === draftApp.id));
    const sameEmailApiMine = await app.inject({ method: 'GET', url: '/api/applications/mine', headers: { cookie: sameEmailUser.cookie } });
    assert.equal(sameEmailApiMine.statusCode, 200);
    assert.ok(!sameEmailApiMine.json().applications.some((a) => a.id === draftApp.id));

    // 2) Approve a Final application owned by ownerUser with contact_email = sharedEmail
    const finalApplicant = (await db.query(`INSERT INTO applicants(first_name_en,last_name_en,date_of_birth,school_name,contact_email,contact_phone)
      VALUES($1,'FinalChild','2016-04-04','Owner School',$2,'0812223333') RETURNING id`, [`OwnFinal${runId}`, sharedEmail])).rows[0].id;
    const finalAppId = (await db.query(`INSERT INTO applications(applicant_id,owner_user_id,source,status,registration_total_satang)
      VALUES($1,$2,'final','approved',0) RETURNING id`, [finalApplicant, ownerUser.id])).rows[0].id;
    const finalItemId = (await db.query(`INSERT INTO application_items(application_id,exam_round_id,grade_id,format,center_id,fee_satang,snapshot,duplicate_key,exam_number)
      VALUES($1,$2,$3,'paper',$4,0,'{}',$5,'FIN100') RETURNING id`, [finalAppId, finalRoundId, gradeId, centerId, randomUUID()])).rows[0].id;

    // Owner can see it; sameEmailUser (duplicate email) CANNOT see it, upload photo, or save shirt size
    assert.ok((await listMyApplications(ownerUser.id)).some((a) => a.id === finalAppId));
    assert.ok(!(await listMyApplications(sameEmailUser.id, sameEmailUser.email)).some((a) => a.id === finalAppId));

    const originalFetch = globalThis.fetch;
    try {
      await installMockGoogleWorkspace();

      // Photo upload & download: owner & admin allowed; sameEmailUser forbidden
      const ownerUpload = await uploadCertificatePhoto(finalAppId, photoPayload, ownerUser.id, ownerUser.email, false);
      assert.equal(ownerUpload.applicationId, finalAppId);
      await assert.rejects(uploadCertificatePhoto(finalAppId, photoPayload, sameEmailUser.id, sameEmailUser.email, false), { statusCode: 403 });
      await assert.rejects(downloadCertificatePhoto(finalItemId, sameEmailUser.id, sameEmailUser.email, false), { statusCode: 403 });
      assert.ok((await downloadCertificatePhoto(finalItemId, ownerUser.id, ownerUser.email, false)).content.length > 0);
      assert.ok((await downloadCertificatePhoto(finalItemId, adminUser.id, adminUser.email, true)).content.length > 0);

      // Shirt size: owner & admin allowed; sameEmailUser forbidden
      assert.equal((await app.inject({ method: 'PUT', url: `/api/applications/${finalAppId}/shirt-sizes`, headers: { cookie: sameEmailUser.cookie }, payload: { items: [{ applicationItemId: finalItemId, shirtSize: 'M' }] } })).statusCode, 403);
      assert.equal((await app.inject({ method: 'PUT', url: `/api/applications/${finalAppId}/shirt-sizes`, headers: { cookie: ownerUser.cookie }, payload: { items: [{ applicationItemId: finalItemId, shirtSize: 'M' }] } })).statusCode, 200);
      assert.equal((await app.inject({ method: 'PUT', url: `/api/applications/${finalAppId}/shirt-sizes`, headers: { cookie: adminUser.cookie }, payload: { items: [{ applicationItemId: finalItemId, shirtSize: 'L' }] } })).statusCode, 200);

      // 3) Changing contact_email to changedEmailUser must NOT grant changedEmailUser access or revoke ownerUser access
      await db.query('UPDATE applicants SET contact_email=$1 WHERE id=$2', [newEmail, finalApplicant]);
      assert.ok(!(await listMyApplications(changedEmailUser.id, changedEmailUser.email)).some((a) => a.id === finalAppId));
      await assert.rejects(uploadCertificatePhoto(finalAppId, photoPayload, changedEmailUser.id, changedEmailUser.email, false), { statusCode: 403 });
      await assert.rejects(downloadCertificatePhoto(finalItemId, changedEmailUser.id, changedEmailUser.email, false), { statusCode: 403 });
      assert.equal((await app.inject({ method: 'PUT', url: `/api/applications/${finalAppId}/shirt-sizes`, headers: { cookie: changedEmailUser.cookie }, payload: { items: [{ applicationItemId: finalItemId, shirtSize: 'S' }] } })).statusCode, 403);
      assert.ok((await listMyApplications(ownerUser.id)).some((a) => a.id === finalAppId));

      // 4) Two coordinators from different schools: coordB cannot access coordA's school batch even if student email matches coordB
      const schoolBatch = await createSchoolDraft({
        schoolName: 'School Alpha',
        source: 'manual',
        applicants: [
          {
            applicant: { firstNameEn: `Alpha${runId}`, middleNameEn: '', lastNameEn: 'One', dateOfBirth: '2016-06-06', schoolName: 'School Alpha', contactEmail: schoolCoordB.email, contactPhone: '0895556666' },
            items: [{ roundId: heatRoundId, gradeId, format: 'paper', centerId }],
            pastPaperIds: [],
          },
          {
            applicant: { firstNameEn: `Alpha${runId}`, middleNameEn: '', lastNameEn: 'Two', dateOfBirth: '2016-07-07', schoolName: 'School Alpha', contactEmail: `stu2-${runId}@example.test`, contactPhone: '0895556666' },
            items: [{ roundId: heatRoundId, gradeId, format: 'paper', centerId }],
            pastPaperIds: [],
          },
        ],
      }, schoolCoordA.id, schoolCoordA.email);
      const [schoolApp1Id, schoolApp2Id] = schoolBatch.applicationIds;
      // Still draft -> coordB cannot see schoolApp1Id even though contact_email === coordB.email
      assert.ok(!(await listMyApplications(schoolCoordB.id, schoolCoordB.email)).some((a) => a.id === schoolApp1Id));
      await db.query("UPDATE applications SET status='approved' WHERE school_batch_id=$1", [schoolBatch.id]);
      const schoolItems = (await db.query('SELECT id,application_id FROM application_items WHERE application_id=ANY($1::uuid[])', [schoolBatch.applicationIds])).rows;
      for (const row of schoolItems) {
        await db.query("UPDATE application_items SET exam_number=$1 WHERE id=$2", [`554${row.id.slice(0, 4)}`, row.id]);
        await db.query("INSERT INTO results(application_item_id,award,eligible_for_final,published_at) VALUES($1,'GOLD AWARD',true,now())", [row.id]);
        await db.query('INSERT INTO final_invitations(heat_application_item_id,final_exam_round_id) VALUES($1,$2)', [row.id, finalRoundId]);
      }
      // Close heat round so photo upload gate is open
      await db.query('UPDATE exam_rounds SET close_date=current_date-1 WHERE id=$1', [heatRoundId]);
      // Even after approval, coordB (different school coordinator) cannot see or upload photo on coordA's student
      assert.ok(!(await listMyApplications(schoolCoordB.id, schoolCoordB.email)).some((a) => a.id === schoolApp1Id));
      await assert.rejects(uploadCertificatePhoto(schoolApp1Id, photoPayload, schoolCoordB.id, schoolCoordB.email, false), { statusCode: 403 });

      // 5) BR-04 / BR-14 public name + phoneLast4 still works for public edit access & school Final claim
      const publicEdit = await getPublicApplicationForEdit(`Alpha${runId} One`, '6666');
      assert.equal(publicEdit.id, schoolApp1Id);

      // Student verifies via BR-04/BR-14 -> verifiable delegation (final_verification_grants) grants student access to their Heat application and ownership of their Final application
      const grantToken = await createFinalVerificationGrant({ candidateName: `Alpha${runId} One`, finalRoundId, phoneLast4: '6666' });
      const grantId = (await db.query('SELECT id FROM final_verification_grants WHERE token_hash=$1', [finalGrantHash(grantToken)])).rows[0].id;
      await bindFinalGrantToUser(grantId, studentSelf.id);

      assert.ok((await listMyApplications(studentSelf.id)).some((a) => a.id === schoolApp1Id), 'verified delegation grants view access');
      assert.ok(!(await listMyApplications(studentSelf.id)).some((a) => a.id === schoolApp2Id), 'delegation stays scoped to verified applicant only');
      // Delegated student can manage Heat certificate photo on their own verified application (and remove it), never on another student
      await uploadCertificatePhoto(schoolApp1Id, photoPayload, studentSelf.id, studentSelf.email, false);
      await removeCertificatePhoto(schoolApp1Id, studentSelf.id, studentSelf.email, false);
      await assert.rejects(uploadCertificatePhoto(schoolApp2Id, photoPayload, studentSelf.id, studentSelf.email, false), { statusCode: 403 });

      // Teacher claims Final for Student 2 -> Final belongs to teacher (schoolCoordA), Heat stays with teacher, and Student 1 cannot see Student 2's Final
      const teacherGrantToken = await createFinalVerificationGrant({ candidateName: `Alpha${runId} Two`, finalRoundId, phoneLast4: '6666' });
      const teacherGrantId = (await db.query('SELECT id FROM final_verification_grants WHERE token_hash=$1', [finalGrantHash(teacherGrantToken)])).rows[0].id;
      await bindFinalGrantToUser(teacherGrantId, schoolCoordA.id);
      const teacherFinal = await submitIndividualApplication({
        applicant: { firstNameEn: `Alpha${runId}`, middleNameEn: '', lastNameEn: 'Two', dateOfBirth: '2016-07-07', schoolName: 'School Alpha', contactEmail: `stu2-${runId}@example.test`, contactPhone: '0895556666' },
        items: [{ roundId: finalRoundId, gradeId, format: 'paper', centerId, packageCode: 'onsite', shirtSize: 'S', guests: [] }],
        pastPaperIds: [],
        sourceHeatApplicationId: schoolApp2Id,
        source: 'final',
        slip: photoPayload,
        certificatePhoto: photoPayload,
      }, schoolCoordA.id, teacherGrantToken);
      assert.ok((await listMyApplications(schoolCoordA.id)).some((a) => a.id === teacherFinal.id));
      assert.ok(!(await listMyApplications(studentSelf.id)).some((a) => a.id === teacherFinal.id));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}
