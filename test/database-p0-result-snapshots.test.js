import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import { createIndividualDraft, submitIndividualApplication, updateOwnedApplicationProfile } from '../server/applications.js';
import { getPool } from '../server/db.js';
import { listFinalEligibilityForUser } from '../server/finalEligibility.js';
import { inspectResultMigrationPreflight, reconcileDuplicatePublishedBatches } from '../server/resultMigrationPreflight.js';
import { importResultRows, listAdminResultWorkflows, listPublishedResultFilters, listPublishedResults, publishResultBatch } from '../server/results.js';
import { seed } from '../server/seed.js';
import { installMockGoogleWorkspace } from './e2e/google-workspace-mock.js';

const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
  test('OCEC-04 result publication snapshot tests require a disposable local PostgreSQL database', { skip: 'Use npm run test:db' }, () => {});
} else {
  const parsed = new URL(testUrl);
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) || !parsed.pathname.toLowerCase().includes('test') || process.env.DATABASE_URL !== testUrl) {
    throw new Error('Use a disposable local test database');
  }

  const suffix = randomUUID().slice(0, 8);
  let ownerId;
  let adminId;
  let gradeId;
  let centerId;

  test.before(async () => {
    await seed();
    const users = await getPool().query(`INSERT INTO users(google_sub,email,display_name,is_admin) VALUES
      ($1,$2,'Snap Owner',false),
      ($3,$4,'Snap Admin',true)
      RETURNING id`, [
      `snap-owner-${suffix}`, `snap-owner-${suffix}@example.test`,
      `snap-admin-${suffix}`, `snap-admin-${suffix}@example.test`,
    ]);
    [ownerId, adminId] = users.rows.map((row) => row.id);
    gradeId = (await getPool().query("SELECT id FROM grade_catalog WHERE label='Primary 1'")).rows[0].id;
    centerId = (await getPool().query("SELECT id FROM exam_centers WHERE code='554'")).rows[0].id;
  });

  test.after(async () => { await getPool().end(); });

  test('published public results remain immutable after profile edits and catalog renames', async () => {
    const db = getPool();
    const compId = `snapcomp-${suffix}`;
    const roundId = `snap-round-${suffix}`;
    const customGradeId = `snap-grade-${suffix}`;
    await db.query("INSERT INTO competitions(id,short_name,name,subject,active) VALUES($1,'SNAP','Original Snap Comp','Math',true)", [compId]);
    await db.query("INSERT INTO grade_catalog(id,label,sort_order,active) VALUES($1,$2,99,true)", [customGradeId, `SnapGrade ${suffix}`]);
    await db.query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date,edit_close_date,is_open)
      VALUES($1,$2,'Original Round Title','2569','HEAT',current_date-1,current_date+1,current_date+10,true)`, [roundId, compId]);
    await db.query('INSERT INTO exam_round_grades(exam_round_id,grade_id) VALUES($1,$2)', [roundId, customGradeId]);
    await db.query('INSERT INTO exam_round_centers(exam_round_id,center_id) VALUES($1,$2)', [roundId, centerId]);

    const appDraft = await createIndividualDraft({
      applicant: {
        firstNameEn: `Original${suffix}`,
        middleNameEn: '',
        lastNameEn: 'Student',
        firstNameTh: 'เดิม',
        lastNameTh: 'นักเรียน',
        dateOfBirth: '2017-01-01',
        schoolName: 'Original Published School',
        contactEmail: `snap-${suffix}@example.test`,
        contactPhone: '0812345678',
      },
      items: [{ roundId, gradeId: customGradeId, format: 'paper', centerId }],
      pastPaperIds: [],
    }, ownerId);
    await db.query("UPDATE applications SET status='approved',approved_at=now() WHERE id=$1", [appDraft.id]);
    await db.query('UPDATE application_items SET exam_number=$2 WHERE application_id=$1', [appDraft.id, `554${suffix.slice(0, 4)}`]);

    await importResultRows(roundId, 'snap.xlsx', [{
      candidateNo: `554${suffix.slice(0, 4)}`,
      grade: `SnapGrade ${suffix}`,
      schoolName: 'Original Published School',
      candidateName: `Original${suffix} Student`,
      award: 'GOLD AWARD',
    }], adminId);
    const published = await publishResultBatch(roundId, adminId);
    assert.equal(published.published, true);
    assert.ok(published.batchId);

    // Mutate applicant profile through the normal owner edit path
    await updateOwnedApplicationProfile(appDraft.id, {
      firstNameEn: `Edited${suffix}`,
      middleNameEn: '',
      lastNameEn: 'Renamed',
      firstNameTh: 'ใหม่',
      lastNameTh: 'เปลี่ยนชื่อ',
      schoolName: 'Changed Later School',
      contactEmail: `snap-${suffix}@example.test`,
      contactPhone: '0812345678',
      address: {},
    }, ownerId);

    // Also mutate catalog labels and round title
    await db.query("UPDATE competitions SET short_name='MUTATED',name='Mutated Comp Name' WHERE id=$1", [compId]);
    await db.query("UPDATE exam_rounds SET title='Mutated Round Title',year='2570' WHERE id=$1", [roundId]);
    await db.query("UPDATE grade_catalog SET label='Mutated Grade' WHERE id=$1", [customGradeId]);
    await db.query("UPDATE application_items SET exam_number='9999999' WHERE application_id=$1", [appDraft.id]);

    // Published public result and filters must keep the published snapshot verbatim
    const publicRows = await listPublishedResults({ competitionId: compId });
    assert.equal(publicRows.length, 1);
    assert.equal(publicRows[0].candidateName, `Original${suffix} Student`);
    assert.equal(publicRows[0].candidateNameTh, 'เดิม นักเรียน');
    assert.equal(publicRows[0].schoolName, 'Original Published School');
    assert.equal(publicRows[0].grade, `SnapGrade ${suffix}`);
    assert.equal(publicRows[0].candidateNo, `554${suffix.slice(0, 4)}`);
    assert.equal(publicRows[0].shortName, 'SNAP');
    assert.equal(publicRows[0].competitionName, 'Original Snap Comp');
    assert.equal(publicRows[0].competitionTitle, 'Original Round Title');
    assert.equal(publicRows[0].year, '2569');

    // Searching by edited name/school must NOT match the old snapshot; searching by original snapshot MUST match
    assert.equal((await listPublishedResults({ q: `Edited${suffix}` })).length, 0);
    assert.equal((await listPublishedResults({ q: 'Changed Later School' })).length, 0);
    assert.equal((await listPublishedResults({ q: `Original${suffix}` })).length, 1);

    const filters = await listPublishedResultFilters();
    const target = filters.targets.find((entry) => entry.targetId === roundId);
    assert.ok(target);
    assert.equal(target.shortName, 'SNAP');
    assert.equal(target.competitionTitle, 'Original Round Title');
    assert.equal(target.year, '2569');
    assert.ok(filters.grades.includes(`SnapGrade ${suffix}`));
    assert.ok(!filters.grades.includes('Mutated Grade'));
  });

  test('concurrent import and publish serialize cleanly without leaving stray drafts or duplicate publications', async () => {
    const db = getPool();
    const roundId = `race-round-${suffix}`;
    await db.query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date,is_open)
      VALUES($1,'bbb','Race Round','2569','HEAT',current_date-1,current_date+1,true)`, [roundId]);
    await db.query('INSERT INTO exam_round_grades(exam_round_id,grade_id) VALUES($1,$2)', [roundId, gradeId]);
    await db.query('INSERT INTO exam_round_centers(exam_round_id,center_id) VALUES($1,$2)', [roundId, centerId]);

    const draftApp = await createIndividualDraft({
      applicant: {
        firstNameEn: `Race${suffix}`,
        lastNameEn: 'Student',
        dateOfBirth: '2017-01-01',
        schoolName: 'Race School',
        contactEmail: `race-${suffix}@example.test`,
        contactPhone: '0812345678',
      },
      items: [{ roundId, gradeId, format: 'paper', centerId }],
      pastPaperIds: [],
    }, ownerId);
    await db.query("UPDATE applications SET status='approved' WHERE id=$1", [draftApp.id]);
    await db.query('UPDATE application_items SET exam_number=$2 WHERE application_id=$1', [draftApp.id, `RC${suffix}`]);

    const rows = [{
      candidateNo: `RC${suffix}`,
      grade: 'Primary 1',
      schoolName: 'Race School',
      candidateName: `Race${suffix} Student`,
      award: '1ST AWARD',
    }];
    await importResultRows(roundId, 'initial.xlsx', rows, adminId);

    const [pub1, pub2, reimport] = await Promise.allSettled([
      publishResultBatch(roundId, adminId),
      publishResultBatch(roundId, adminId),
      importResultRows(roundId, 'overwrite.xlsx', [{ ...rows[0], award: 'MERIT AWARD' }], adminId),
    ]);

    const publishedWins = [pub1, pub2].filter((outcome) => outcome.status === 'fulfilled');
    assert.equal(publishedWins.length, 1, 'exactly one publish call should succeed');
    const publishedCount = await db.query("SELECT count(*)::int AS total FROM result_import_batches WHERE exam_round_id=$1 AND status='published'", [roundId]);
    const draftCount = await db.query("SELECT count(*)::int AS total FROM result_import_batches WHERE exam_round_id=$1 AND status='draft'", [roundId]);
    assert.equal(publishedCount.rows[0].total, 1);
    assert.equal(draftCount.rows[0].total, 0, 'no stray draft may remain after publication');
    // Regardless of whether reimport ran before or after publish, a subsequent publish or import MUST fail with 409
    await assert.rejects(importResultRows(roundId, 'late.xlsx', rows, adminId), { statusCode: 409 });
    await assert.rejects(publishResultBatch(roundId, adminId), { statusCode: 409 });
    // DB unique constraint directly rejects a second published batch for the same round
    await assert.rejects(
      db.query("INSERT INTO result_import_batches(exam_round_id,file_name,status,published_at) VALUES($1,'dup.xlsx','published',now())", [roundId]),
      { code: '23505' },
    );
    if (reimport.status === 'rejected') {
      assert.equal(reimport.reason.statusCode, 409);
    }
  });

  test('migration 024 backfills snapshots from import rows and flags legacy rows without import batches', async () => {
    const db = getPool();
    const roundId = `backfill-round-${suffix}`;
    await db.query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date,is_open)
      VALUES($1,'timo','Backfill Round','2569','HEAT',current_date-1,current_date+1,true)`, [roundId]);
    await db.query('INSERT INTO exam_round_grades(exam_round_id,grade_id) VALUES($1,$2)', [roundId, gradeId]);
    await db.query('INSERT INTO exam_round_centers(exam_round_id,center_id) VALUES($1,$2)', [roundId, centerId]);

    const appWithImport = await createIndividualDraft({
      applicant: { firstNameEn: `BfImp${suffix}`, lastNameEn: 'Student', dateOfBirth: '2017-01-01', schoolName: 'Import School', contactEmail: `bf1-${suffix}@example.test`, contactPhone: '0812345678' },
      items: [{ roundId, gradeId, format: 'paper', centerId }],
      pastPaperIds: [],
    }, ownerId);
    const appLegacy = await createIndividualDraft({
      applicant: { firstNameEn: `BfLeg${suffix}`, lastNameEn: 'Student', dateOfBirth: '2017-01-02', schoolName: 'Legacy School', contactEmail: `bf2-${suffix}@example.test`, contactPhone: '0812345678' },
      items: [{ roundId, gradeId, format: 'paper', centerId }],
      pastPaperIds: [],
    }, ownerId);
    const itemImp = (await db.query("UPDATE application_items SET exam_number=$2 WHERE application_id=$1 RETURNING id", [appWithImport.id, `BFI${suffix}`])).rows[0].id;
    const itemLeg = (await db.query("UPDATE application_items SET exam_number=$2 WHERE application_id=$1 RETURNING id", [appLegacy.id, `BFL${suffix}`])).rows[0].id;
    const batch = (await db.query("INSERT INTO result_import_batches(exam_round_id,file_name,status,published_at) VALUES($1,'bf.xlsx','published',now()) RETURNING id", [roundId])).rows[0].id;
    await db.query(`INSERT INTO result_import_rows(batch_id,row_number,candidate_no,grade,school_name,candidate_name,award,application_item_id,match_status)
      VALUES($1,2,$2,'Primary 1','Imported Historical School',$3,'GOLD AWARD',$4,'matched')`, [batch, `BFI${suffix}`, `BfImp${suffix} Historical`, itemImp]);
    await db.query("INSERT INTO results(application_item_id,award,eligible_for_final,published_at) VALUES($1,'GOLD AWARD',true,now()),($2,'SILVER AWARD',true,now())", [itemImp, itemLeg]);

    const sql = await readFile(new URL('../server/migrations/024_result_publication_snapshots.sql', import.meta.url), 'utf8');
    await db.query(sql);

    const impResult = (await db.query('SELECT snapshot_school_name,snapshot_candidate_name,snapshot_needs_review,published_batch_id FROM results WHERE application_item_id=$1', [itemImp])).rows[0];
    assert.equal(impResult.snapshot_school_name, 'Imported Historical School');
    assert.equal(impResult.snapshot_candidate_name, `BfImp${suffix} Historical`);
    assert.equal(impResult.snapshot_needs_review, false);
    assert.equal(impResult.published_batch_id, batch);

    const legResult = (await db.query('SELECT snapshot_school_name,snapshot_needs_review,published_batch_id FROM results WHERE application_item_id=$1', [itemLeg])).rows[0];
    assert.equal(legResult.snapshot_school_name, 'Legacy School');
    assert.equal(legResult.snapshot_needs_review, true);
    assert.equal(legResult.published_batch_id, null);
  });

  test('upgrades safely from pre-024 schema with read-only preflight, duplicate published batch guard, and evidence-preserving reconciliation', async () => {
    const schemaName = `pre024_upgrade_${suffix.replace(/[^a-z0-9]/gi, '')}`;
    const adminPool = getPool();
    await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
    const upgradePool = new pg.Pool({
      connectionString: testUrl,
      options: `-c search_path=${schemaName}`,
    });

    try {
      // 1) Build an authentic pre-024 database by applying only migrations 001..022.
      const migrationsDir = new URL('../server/migrations/', import.meta.url);
      const migrationFiles = (await readdir(migrationsDir))
        .filter((name) => /^\d+.*\.sql$/.test(name) && name < '023_')
        .sort();
      assert.equal(migrationFiles.at(-1), '022_final_overseas_center.sql');
      for (const file of migrationFiles) {
        const sql = await readFile(new URL(file, migrationsDir), 'utf8');
        await upgradePool.query(sql);
      }

      // Seed minimal reference data for 3 rounds: normal, unrecoverable legacy, and duplicate published batches.
      const user = (await upgradePool.query("INSERT INTO users(google_sub,email,display_name,is_admin) VALUES('up-admin','up-admin@example.test','Upgrade Admin',true) RETURNING id")).rows[0].id;
      await upgradePool.query("INSERT INTO competitions(id,short_name,name,subject) VALUES('timo','TIMO','Thailand International Mathematical Olympiad','Math') ON CONFLICT (id) DO NOTHING");
      await upgradePool.query("INSERT INTO grade_catalog(id,label,sort_order) VALUES('g1','Primary 1',1) ON CONFLICT DO NOTHING");
      await upgradePool.query("INSERT INTO exam_centers(id,code,name) VALUES('c554','554','Bangkok Center') ON CONFLICT DO NOTHING");
      for (const roundId of ['round-normal', 'round-legacy', 'round-dup']) {
        await upgradePool.query("INSERT INTO exam_rounds(id,competition_id,title,year,round_type,is_open) VALUES($1,'timo',$1,'2569','HEAT',true)", [roundId]);
      }

      async function createItem(roundId, name, school, examNumber) {
        const ap = (await upgradePool.query(
          "INSERT INTO applicants(first_name_en,last_name_en,date_of_birth,school_name,contact_email,contact_phone) VALUES($1,'Student','2017-01-01',$2,'u@example.test','0812345678') RETURNING id",
          [name, school],
        )).rows[0].id;
        const appRow = (await upgradePool.query(
          "INSERT INTO applications(applicant_id,owner_user_id,source,status,registration_total_satang) VALUES($1,$2,'self','approved',75500) RETURNING id",
          [ap, user],
        )).rows[0].id;
        return (await upgradePool.query(
          "INSERT INTO application_items(application_id,exam_round_id,grade_id,format,center_id,fee_satang,snapshot,duplicate_key,exam_number) VALUES($1,$2,'g1','paper','c554',75500,'{}',$3,$4) RETURNING id",
          [appRow, roundId, `${roundId}-${examNumber}`, examNumber],
        )).rows[0].id;
      }

      const normalItem = await createItem('round-normal', 'Normal', 'Normal School', '5540001');
      const legacyItem = await createItem('round-legacy', 'Legacy', 'Legacy School', '5540002');
      const dupItem = await createItem('round-dup', 'Dup', 'Dup School', '5540003');

      // Round A (normal): 1 published batch + import row + result
      const normalBatch = (await upgradePool.query("INSERT INTO result_import_batches(exam_round_id,file_name,status,published_at,published_by) VALUES('round-normal','normal.xlsx','published',now(),$1) RETURNING id", [user])).rows[0].id;
      await upgradePool.query("INSERT INTO result_import_rows(batch_id,row_number,candidate_no,grade,school_name,candidate_name,award,application_item_id,match_status) VALUES($1,2,'5540001','Primary 1','Normal Import School','Normal Student','GOLD AWARD',$2,'matched')", [normalBatch, normalItem]);
      await upgradePool.query("INSERT INTO results(application_item_id,award,eligible_for_final,published_at,published_by) VALUES($1,'GOLD AWARD',true,now(),$2)", [normalItem, user]);

      // Round B (unrecoverable): published result with NO import row
      await upgradePool.query("INSERT INTO results(application_item_id,award,eligible_for_final,published_at,published_by) VALUES($1,'SILVER AWARD',true,now(),$2)", [legacyItem, user]);

      // Round C (duplicate published batches): 2 published batches for the same round
      const dupBatchOld = (await upgradePool.query("INSERT INTO result_import_batches(exam_round_id,file_name,status,published_at,published_by) VALUES('round-dup','dup-old.xlsx','published',now()-interval '1 day',$1) RETURNING id", [user])).rows[0].id;
      const dupBatchApproved = (await upgradePool.query("INSERT INTO result_import_batches(exam_round_id,file_name,status,published_at,published_by) VALUES('round-dup','dup-approved.xlsx','published',now(),$1) RETURNING id", [user])).rows[0].id;
      await upgradePool.query("INSERT INTO result_import_rows(batch_id,row_number,candidate_no,grade,school_name,candidate_name,award,application_item_id,match_status) VALUES($1,2,'5540003','Primary 1','Old Wrong School','Dup Student','MERIT AWARD',$2,'matched')", [dupBatchOld, dupItem]);
      await upgradePool.query("INSERT INTO result_import_rows(batch_id,row_number,candidate_no,grade,school_name,candidate_name,award,application_item_id,match_status) VALUES($1,2,'5540003','Primary 1','Owner Approved School','Dup Student','GOLD AWARD',$2,'matched')", [dupBatchApproved, dupItem]);
      await upgradePool.query("INSERT INTO results(application_item_id,award,eligible_for_final,published_at,published_by) VALUES($1,'MERIT AWARD',false,now(),$2)", [dupItem, user]);

      // 2) Run read-only preflight on pre-024 schema -> must report duplicate round + unrecoverable snapshot without modifying anything
      const preflightBefore = await inspectResultMigrationPreflight(upgradePool);
      assert.equal(preflightBefore.readOnly, true);
      assert.equal(preflightBefore.schemaHas024Columns, false);
      assert.equal(preflightBefore.safeToApply, false);
      assert.equal(preflightBefore.duplicatePublishedRounds.length, 1);
      assert.equal(preflightBefore.duplicatePublishedRounds[0].examRoundId, 'round-dup');
      assert.equal(preflightBefore.duplicatePublishedRounds[0].publishedBatchCount, 2);
      assert.equal(preflightBefore.unrecoverableSnapshots.totalPublishedResults, 3);
      assert.equal(preflightBefore.unrecoverableSnapshots.recoverableFromImport, 2);
      assert.equal(preflightBefore.unrecoverableSnapshots.missingImportRows, 1);
      // Preflight distinguishes display-details-only legacy rows (computed per BR-01) from unverified candidate/award rows for OCEC manual check
      assert.equal(preflightBefore.unrecoverableSnapshots.missingDisplayDetailsOnlyCount, 1);
      assert.equal(preflightBefore.unrecoverableSnapshots.missingDisplayDetailsOnly[0].examRoundId, 'round-legacy');
      assert.equal(preflightBefore.unrecoverableSnapshots.missingDisplayDetailsOnly[0].computedEligibleByRule, true);
      assert.equal(preflightBefore.unrecoverableSnapshots.unverifiedCandidateOrAwardCount, 1);
      assert.equal(preflightBefore.manualReviewForOcecTeam[0].examRoundId, 'round-dup');
      assert.equal(preflightBefore.manualReviewForOcecTeam[0].reason, 'duplicate_published_batches');

      // 3) Attempting migration 024 before reconciling duplicates MUST abort cleanly with actionable error
      const sql024 = await readFile(new URL('../server/migrations/024_result_publication_snapshots.sql', import.meta.url), 'utf8');
      await assert.rejects(async () => {
        const client = await upgradePool.connect();
        try {
          await client.query('BEGIN');
          await client.query(sql024);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      }, /Migration 024 blocked: duplicate published result batches found for exam_round_id\(s\): round-dup/);

      // 4) Reconcile duplicate round using Result Owner approved reference batch -> preserves superseded batch & rows as evidence
      const reconciled = await reconcileDuplicatePublishedBatches({
        examRoundId: 'round-dup',
        approvedBatchId: dupBatchApproved,
        ownerApprovalNote: 'Approved by Result Owner on 2026-11-24 (ticket OCEC-04)',
        actorUserId: user,
      }, upgradePool);
      assert.deepEqual(reconciled.supersededBatchIds, [dupBatchOld]);
      assert.equal(reconciled.preservedEvidenceRows, 1);

      const oldBatch = (await upgradePool.query('SELECT status,superseded_by_batch_id,owner_approval_note FROM result_import_batches WHERE id=$1', [dupBatchOld])).rows[0];
      assert.equal(oldBatch.status, 'superseded');
      assert.equal(oldBatch.superseded_by_batch_id, dupBatchApproved);
      assert.match(oldBatch.owner_approval_note, /Result Owner/);
      assert.equal((await upgradePool.query('SELECT count(*)::int AS n FROM result_import_rows WHERE batch_id=$1', [dupBatchOld])).rows[0].n, 1, 'superseded import rows must be preserved');
      assert.equal((await upgradePool.query("SELECT count(*)::int AS n FROM audit_logs WHERE entity_type='exam_round' AND entity_id='round-dup' AND action='reconcile_duplicate_published_batches'")).rows[0].n, 1);

      // 5) Preflight is now safe to apply; run migration 024 cleanly
      const preflightReady = await inspectResultMigrationPreflight(upgradePool);
      assert.equal(preflightReady.safeToApply, true);
      assert.equal(preflightReady.duplicatePublishedRounds.length, 0);

      await upgradePool.query(sql024);

      // 6) Verify backfilled snapshots across all three rounds
      const normalSnap = (await upgradePool.query('SELECT published_batch_id,snapshot_school_name,snapshot_needs_review FROM results WHERE application_item_id=$1', [normalItem])).rows[0];
      assert.equal(normalSnap.published_batch_id, normalBatch);
      assert.equal(normalSnap.snapshot_school_name, 'Normal Import School');
      assert.equal(normalSnap.snapshot_needs_review, false);

      const legacySnap = (await upgradePool.query('SELECT published_batch_id,snapshot_school_name,snapshot_needs_review FROM results WHERE application_item_id=$1', [legacyItem])).rows[0];
      assert.equal(legacySnap.published_batch_id, null);
      assert.equal(legacySnap.snapshot_school_name, 'Legacy School');
      assert.equal(legacySnap.snapshot_needs_review, true);

      const dupSnap = (await upgradePool.query('SELECT published_batch_id,award,eligible_for_final,snapshot_school_name,snapshot_needs_review FROM results WHERE application_item_id=$1', [dupItem])).rows[0];
      assert.equal(dupSnap.published_batch_id, dupBatchApproved);
      assert.equal(dupSnap.award, 'GOLD AWARD');
      assert.equal(dupSnap.eligible_for_final, true);
      assert.equal(dupSnap.snapshot_school_name, 'Owner Approved School');
      assert.equal(dupSnap.snapshot_needs_review, false);

      const postPreflight = await inspectResultMigrationPreflight(upgradePool);
      assert.equal(postPreflight.schemaHas024Columns, true);
      assert.equal(postPreflight.safeToApply, true);
      assert.equal(postPreflight.unrecoverableSnapshots.byRound.find((r) => r.examRoundId === 'round-legacy').flaggedNeedsReview, 1);
    } finally {
      await upgradePool.end();
      await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
  });

  test('approved published batch governs public results, admin workflow (even when created earlier), and Final eligibility while excluding superseded-only applicants', async () => {
    const db = getPool();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const slip = { fileName: 'slip.png', mimeType: 'image/png', dataBase64: png.toString('base64') };
    const photo = { fileName: 'photo.png', mimeType: 'image/png', dataBase64: png.toString('base64') };

    const users = await db.query(`INSERT INTO users(google_sub,email,display_name,is_admin) VALUES
      ($1,$2,'Owner A',false),
      ($3,$4,'Owner B',false)
      RETURNING id`, [
      `ab-owner-a-${suffix}`, `ab-a-${suffix}@example.test`,
      `ab-owner-b-${suffix}`, `ab-b-${suffix}@example.test`,
    ]);
    const [ownerA, ownerB] = users.rows.map((row) => row.id);
    const heatRoundId = `bbb-heat-ab-${suffix}`;
    const finalRoundId = `bbb-final-ab-${suffix}`;
    for (const [id, type] of [[heatRoundId, 'HEAT'], [finalRoundId, 'FINAL']]) {
      await db.query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date,is_open)
        VALUES($1,'bbb',$1,'2569',$2,current_date-1,current_date+1,true)`, [id, type]);
      await db.query('INSERT INTO exam_round_grades(exam_round_id,grade_id) VALUES($1,$2)', [id, gradeId]);
      await db.query('INSERT INTO exam_round_centers(exam_round_id,center_id) VALUES($1,$2)', [id, centerId]);
    }

    const applicantA = { firstNameEn: `Alpha${suffix}`, lastNameEn: 'Approved', dateOfBirth: '2017-01-01', schoolName: 'AB School', contactEmail: `a-${suffix}@example.test`, contactPhone: '0811111111' };
    const applicantB = { firstNameEn: `Beta${suffix}`, lastNameEn: 'SupersededOnly', dateOfBirth: '2017-02-02', schoolName: 'AB School', contactEmail: `b-${suffix}@example.test`, contactPhone: '0822222222' };
    const appA = await createIndividualDraft({ applicant: applicantA, items: [{ roundId: heatRoundId, gradeId, format: 'paper', centerId }], pastPaperIds: [] }, ownerA);
    const appB = await createIndividualDraft({ applicant: applicantB, items: [{ roundId: heatRoundId, gradeId, format: 'paper', centerId }], pastPaperIds: [] }, ownerB);
    await db.query("UPDATE applications SET status='approved' WHERE id=ANY($1::uuid[])", [[appA.id, appB.id]]);
    const itemA = (await db.query("UPDATE application_items SET exam_number=$2 WHERE application_id=$1 RETURNING id", [appA.id, `ABA${suffix}`])).rows[0].id;
    const itemB = (await db.query("UPDATE application_items SET exam_number=$2 WHERE application_id=$1 RETURNING id", [appB.id, `ABB${suffix}`])).rows[0].id;

    // Simulate legacy pre-024 duplicate published batches:
    //  - Approved batch (created EARLIER) contains ONLY A (1ST AWARD)
    //  - Superseded batch (created LATER!) contains BOTH A (1ST AWARD) and B (2ND AWARD)
    const approvedBatch = (await db.query(`INSERT INTO result_import_batches(exam_round_id,file_name,status,created_at,published_at,published_by)
      VALUES($1,'approved-earlier.xlsx','superseded',now()-interval '2 hours',now()-interval '2 hours',$2) RETURNING id`, [heatRoundId, adminId])).rows[0].id;
    const supersededBatch = (await db.query(`INSERT INTO result_import_batches(exam_round_id,file_name,status,created_at,published_at,published_by)
      VALUES($1,'old-with-ab-later.xlsx','published',now()-interval '1 hour',now()-interval '1 hour',$2) RETURNING id`, [heatRoundId, adminId])).rows[0].id;
    await db.query(`INSERT INTO result_import_rows(batch_id,row_number,candidate_no,grade,school_name,candidate_name,award,application_item_id,match_status)
      VALUES($1,2,$2,'Primary 1','AB School',$3,'1ST AWARD',$4,'matched')`, [approvedBatch, `ABA${suffix}`, `${applicantA.firstNameEn} Approved`, itemA]);
    await db.query(`INSERT INTO result_import_rows(batch_id,row_number,candidate_no,grade,school_name,candidate_name,award,application_item_id,match_status)
      VALUES
        ($1,2,$2,'Primary 1','AB School',$3,'1ST AWARD',$4,'matched'),
        ($1,3,$5,'Primary 1','AB School',$6,'2ND AWARD',$7,'matched')`, [
      supersededBatch, `ABA${suffix}`, `${applicantA.firstNameEn} Approved`, itemA,
      `ABB${suffix}`, `${applicantB.firstNameEn} SupersededOnly`, itemB,
    ]);
    // Both A and B initially had published results & unclaimed Final invitations from the old batch
    await db.query(`INSERT INTO results(application_item_id,award,eligible_for_final,published_at,published_by,published_batch_id)
      VALUES($1,'1ST AWARD',true,now(),$2,$3),($4,'2ND AWARD',true,now(),$2,$3)`, [itemA, adminId, supersededBatch, itemB]);
    await db.query('INSERT INTO final_invitations(heat_application_item_id,final_exam_round_id) VALUES($1,$2),($3,$2)', [itemA, finalRoundId, itemB]);

    // Temporarily flip approvedBatch to published alongside supersededBatch by dropping unique index? No — mark approvedBatch published after temporarily switching supersededBatch in a realistic post-reconcile or use reconcileDuplicatePublishedBatches by marking approvedBatch published inside a clean check:
    // Actually, test the real reconcile flow by switching supersededBatch -> superseded via reconcile after testing pre-024 or simulating both published via dedicated schema?
    // Even simpler: drop & restore index ONLY inside a sub-schema? No — we want to test listPublishedResults, listAdminResultWorkflows, listFinalEligibilityForUser, and submitIndividualApplication on the main pool!
    // We can set approvedBatch to published and supersededBatch to superseded via SQL? Wait: let's have reconcileDuplicatePublishedBatches ALSO handle switching from an existing published batch when approvedBatchId is selected, OR test reconcile on a real duplicate pair!
    // First switch approvedBatch -> 'published' by marking supersededBatch -> 'superseded' via reconcile:
    await db.query("UPDATE result_import_batches SET status='superseded' WHERE id=$1", [supersededBatch]);
    await db.query("UPDATE result_import_batches SET status='published' WHERE id=$1", [approvedBatch]);
    // Put stale B row & invitation back so reconcile must clean it up when aligning to approvedBatch!
    const reconciled = await reconcileDuplicatePublishedBatches({
      examRoundId: heatRoundId,
      approvedBatchId: approvedBatch,
      ownerApprovalNote: 'OCEC team selected approved-earlier.xlsx containing only A',
      actorUserId: adminId,
    });
    assert.deepEqual(reconciled.unpublishedItemIds, [itemB]);

    // 1) Admin workflow opens the APPROVED batch even though it was created EARLIER than the superseded batch
    const workflows = await listAdminResultWorkflows();
    assert.equal(workflows[heatRoundId].id, approvedBatch);
    assert.equal(workflows[heatRoundId].fileName, 'approved-earlier.xlsx');
    assert.equal(workflows[heatRoundId].status, 'published');
    assert.equal(workflows[heatRoundId].rows.length, 1);

    // 2) Superseded batch & its rows (A and B) are preserved as history
    const preserved = await db.query('SELECT status FROM result_import_batches WHERE id=$1', [supersededBatch]);
    assert.equal(preserved.rows[0].status, 'superseded');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM result_import_rows WHERE batch_id=$1', [supersededBatch])).rows[0].n, 2);

    // 3) Public results show ONLY A, NOT B
    const publicRows = (await listPublishedResults({ competitionId: 'bbb', roundType: 'HEAT' })).filter((row) => row.targetId === heatRoundId);
    assert.equal(publicRows.length, 1);
    assert.equal(publicRows[0].applicationItemId, itemA);
    assert.ok(!publicRows.some((row) => row.applicationItemId === itemB));

    // 4) Final eligibility shows ONLY A; B has zero choices and CANNOT submit Final (even if an unclaimed invitation were manually injected!)
    const eligA = await listFinalEligibilityForUser(ownerA);
    assert.ok(eligA.some((choice) => choice.sourceHeatApplicationId === appA.id && choice.item.roundId === finalRoundId));
    assert.deepEqual(await listFinalEligibilityForUser(ownerB), []);

    // Even if a stale invitation for B exists, server-side Final submission rejects B with 403!
    await db.query('INSERT INTO final_invitations(heat_application_item_id,final_exam_round_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [itemB, finalRoundId]);
    const originalFetch = globalThis.fetch;
    try {
      await installMockGoogleWorkspace();
      await assert.rejects(submitIndividualApplication({
        applicant: applicantB,
        items: [{ roundId: finalRoundId, gradeId, format: 'paper', centerId, packageCode: 'onsite_ceremony', shirtSize: 'M', guests: [] }],
        pastPaperIds: [],
        sourceHeatApplicationId: appB.id,
        source: 'final',
        slip,
        certificatePhoto: photo,
      }, ownerB), { statusCode: 403 });

      // Meanwhile A submits Final successfully!
      const submittedA = await submitIndividualApplication({
        applicant: applicantA,
        items: [{ roundId: finalRoundId, gradeId, format: 'paper', centerId, packageCode: 'onsite_ceremony', shirtSize: 'M', guests: [] }],
        pastPaperIds: [],
        sourceHeatApplicationId: appA.id,
        source: 'final',
        slip,
        certificatePhoto: photo,
      }, ownerA);
      assert.ok(submittedA.id);
    } finally {
      globalThis.fetch = originalFetch;
      await db.query("DELETE FROM google_workspace_connection WHERE account_email='workspace@ocec.test'");
    }
  });
}
