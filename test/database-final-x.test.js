import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { installMockGoogleWorkspace } from './e2e/google-workspace-mock.js';
import { randomUUID } from 'node:crypto';
import { createIndividualDraft, submitIndividualApplication, uploadCertificatePhoto } from '../server/applications.js';
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
    await assert.rejects(saveCatalogSnapshot(await loadCatalog(), user), /Final X เปิดให้เฉพาะ BBB/);
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
      await assert.rejects(submitIndividualApplication({ ...candidate, source: 'final', slip: { fileName: 'slip.png', mimeType: 'image/png', dataBase64: Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64') } }, other, token), (error) => error.statusCode === 503 && error.message.includes('Google Workspace'));
      assert.equal((await db.query("SELECT claimed_application_id FROM final_invitations WHERE final_exam_round_id='test-bbb-x'")).rows[0].claimed_application_id, null);
      await installMockGoogleWorkspace();
      const mockFetch = globalThis.fetch;
      globalThis.fetch = async (url, options = {}) => {
        const target = new URL(url);
        if (target.pathname === '/drive/v3/files' && options.method === 'POST') folders.push(JSON.parse(options.body));
        if (target.pathname === '/upload/drive/v3/files') uploads.push(options.body);
        return mockFetch(url, options);
      };
      const submission = { ...candidate, source: 'final', slip: { fileName: 'slip.png', mimeType: 'image/png', dataBase64: Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64') } };
      const submitted = await submitIndividualApplication(submission, other, token);
      assert.equal((await db.query("SELECT claimed_application_id FROM final_invitations WHERE final_exam_round_id='test-bbb-x'")).rows[0].claimed_application_id, submitted.id);
      await assert.rejects(submitIndividualApplication(submission, other, token), (error) => [403,409].includes(error.statusCode));
      folders.length = 0;
      uploads.length = 0;
      const image = Buffer.from([255,216,255,0,1,2,3]);
      const uploaded = await uploadCertificatePhoto(source.id, { fileName: 'photo.jpg', mimeType: 'image/jpeg', dataBase64: image.toString('base64') }, user, 'final-x@example.test');
      assert.equal(uploaded.photo.itemCount, 2);
      assert.deepEqual([folders.slice(0, 3), folders.slice(3)].map(group => group.map(folder => folder.name)).sort((a, b) => a[1].localeCompare(b[1])), [['2569','BBB','Final'], ['2569','HKISO','Final']]);
      assert.equal(uploads.length, 2);
      assert.ok(uploads.some(body => body.includes(Buffer.from('FINAL123_Finalx_Student.jpg'))));
      assert.ok(uploads.some(body => body.includes(Buffer.from('ISO456_Finalx_Student.jpg'))));
      assert.ok(uploads.every((body) => body.includes(image)));
      await importResultRows('test-hkiso-photo','hkiso-final.xlsx', [{ candidateNo: 'ISO456', grade: 'Primary 1', school: 'Test School', candidate: 'Finalx Student', award: 'GOLD AWARD' }], user);
      const terminal = await publishResultBatch('test-hkiso-photo', user);
      assert.equal(terminal.eligibleForFinal, 0);
      assert.equal(terminal.openedFinalRounds, 0);
      assert.equal((await db.query("SELECT count(*)::int AS total FROM final_invitations WHERE final_exam_round_id='invalid-hkiso-x'")).rows[0].total, 0);
    } finally { globalThis.fetch = originalFetch; }
  });
  test.after(async () => { await getPool().end(); });
}
