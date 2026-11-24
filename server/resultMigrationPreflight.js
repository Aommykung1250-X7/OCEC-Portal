import { isEligibleForNextRound, nextExamRoundType } from '../shared/examProgression.js';
import { getPool } from './db.js';

/**
 * Strictly read-only preflight inspection for migration 024 (works on both pre-024 and post-024 schemas).
 * Classifies incomplete legacy published results into two distinct categories:
 *  - missingDisplayDetailsOnly: candidate & award are verifiable so eligibility follows BR-01 normally; only display snapshot metadata is incomplete.
 *  - unverifiedCandidateOrAward: cannot confirm who received which award in an approved batch (e.g. duplicate published batches, row absent from active published batch, award mismatch, or blank award) -> must be sent to OCEC team to check against the original sheet before modifying live data.
 */
export async function inspectResultMigrationPreflight(pool = getPool()) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');

    const duplicateRoundsResult = await client.query(`
      SELECT
        b.exam_round_id,
        count(*)::int AS published_batch_count,
        json_agg(
          json_build_object(
            'id', b.id,
            'fileName', b.file_name,
            'createdAt', b.created_at,
            'publishedAt', b.published_at,
            'publishedBy', b.published_by,
            'rowCount', (SELECT count(*)::int FROM result_import_rows ir WHERE ir.batch_id = b.id)
          )
          ORDER BY b.published_at DESC NULLS LAST, b.created_at DESC, b.id
        ) AS batches
      FROM result_import_batches b
      WHERE b.status = 'published'
      GROUP BY b.exam_round_id
      HAVING count(*) > 1
      ORDER BY b.exam_round_id
    `);

    const snapshotColumnCheck = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'results' AND column_name = 'snapshot_needs_review'
    `);
    const hasPost024Columns = snapshotColumnCheck.rowCount > 0;

    const publishedBatchCountsResult = await client.query(`
      SELECT exam_round_id, count(*)::int AS cnt
      FROM result_import_batches
      WHERE status = 'published'
      GROUP BY exam_round_id
    `);
    const publishedBatchCountByRound = new Map(
      publishedBatchCountsResult.rows.map((row) => [row.exam_round_id, row.cnt]),
    );

    const rowsResult = await client.query(`
      SELECT
        res.application_item_id,
        res.award,
        res.eligible_for_final,
        ${hasPost024Columns ? 'res.snapshot_needs_review,' : 'false AS snapshot_needs_review,'}
        ai.exam_round_id,
        ai.exam_number,
        r.competition_id,
        r.round_type,
        ap.school_name,
        concat_ws(' ', ap.first_name_en, nullif(ap.middle_name_en, ''), ap.last_name_en) AS candidate_name,
        ir_active.id AS active_import_row_id,
        ir_active.award AS active_import_award,
        ir_active.school_name AS active_import_school,
        ir_active.candidate_name AS active_import_candidate
      FROM results res
      JOIN application_items ai ON ai.id = res.application_item_id
      JOIN applications a ON a.id = ai.application_id
      JOIN applicants ap ON ap.id = a.applicant_id
      JOIN exam_rounds r ON r.id = ai.exam_round_id
      LEFT JOIN LATERAL (
        SELECT ir.id, ir.award, ir.school_name, ir.candidate_name
        FROM result_import_rows ir
        JOIN result_import_batches b ON b.id = ir.batch_id AND b.status = 'published'
        WHERE ir.application_item_id = res.application_item_id
        ORDER BY b.published_at DESC NULLS LAST, b.created_at DESC
        LIMIT 1
      ) ir_active ON true
      WHERE res.published_at IS NOT NULL
      ORDER BY ai.exam_round_id, res.application_item_id
    `);

    await client.query('ROLLBACK');

    const duplicatePublishedRounds = duplicateRoundsResult.rows.map((row) => ({
      examRoundId: row.exam_round_id,
      publishedBatchCount: row.published_batch_count,
      batches: row.batches,
    }));

    const byRoundMap = new Map();
    const missingDisplayDetailsOnly = [];
    const unverifiedCandidateOrAward = [];

    for (const row of rowsResult.rows) {
      const roundId = row.exam_round_id;
      const batchCount = publishedBatchCountByRound.get(roundId) || 0;
      const hasImportRow = Boolean(row.active_import_row_id);
      const awardText = String(row.award || '').trim();
      const computedEligible = isEligibleForNextRound(awardText, row.competition_id, row.round_type);

      if (!byRoundMap.has(roundId)) {
        byRoundMap.set(roundId, {
          examRoundId: roundId,
          totalPublishedResults: 0,
          recoverableFromImport: 0,
          missingImportRows: 0,
          missingDisplayDetailsOnlyCount: 0,
          unverifiedCandidateOrAwardCount: 0,
          ...(hasPost024Columns ? { flaggedNeedsReview: 0 } : {}),
        });
      }
      const stats = byRoundMap.get(roundId);
      stats.totalPublishedResults += 1;
      if (hasImportRow) stats.recoverableFromImport += 1;
      else stats.missingImportRows += 1;
      if (hasPost024Columns && row.snapshot_needs_review) stats.flaggedNeedsReview += 1;

      const awardMatchesImport = hasImportRow
        && String(row.active_import_award || '').trim().toUpperCase() === awardText.toUpperCase();

      if (batchCount > 1) {
        stats.unverifiedCandidateOrAwardCount += 1;
        unverifiedCandidateOrAward.push({
          examRoundId: roundId,
          applicationItemId: row.application_item_id,
          candidateName: row.candidate_name,
          award: awardText,
          reason: 'duplicate_published_batches',
        });
      } else if (!awardText || !String(row.candidate_name || '').trim()) {
        stats.unverifiedCandidateOrAwardCount += 1;
        unverifiedCandidateOrAward.push({
          examRoundId: roundId,
          applicationItemId: row.application_item_id,
          candidateName: row.candidate_name || '',
          award: awardText,
          reason: 'missing_candidate_or_award',
        });
      } else if (batchCount === 1 && !hasImportRow) {
        stats.unverifiedCandidateOrAwardCount += 1;
        unverifiedCandidateOrAward.push({
          examRoundId: roundId,
          applicationItemId: row.application_item_id,
          candidateName: row.candidate_name,
          award: awardText,
          reason: 'absent_from_approved_published_batch',
        });
      } else if (batchCount === 1 && !awardMatchesImport) {
        stats.unverifiedCandidateOrAwardCount += 1;
        unverifiedCandidateOrAward.push({
          examRoundId: roundId,
          applicationItemId: row.application_item_id,
          candidateName: row.candidate_name,
          award: awardText,
          approvedBatchAward: row.active_import_award,
          reason: 'award_mismatch_with_approved_batch',
        });
      } else if (!hasImportRow) {
        // batchCount === 0: legacy direct result row with verifiable applicant + award; only import-sheet display metadata is absent.
        stats.missingDisplayDetailsOnlyCount += 1;
        missingDisplayDetailsOnly.push({
          examRoundId: roundId,
          applicationItemId: row.application_item_id,
          candidateName: row.candidate_name,
          award: awardText,
          storedEligibleForFinal: Boolean(row.eligible_for_final),
          computedEligibleByRule: computedEligible,
          eligibilityMatchesRule: Boolean(row.eligible_for_final) === computedEligible,
          missingFields: ['import_batch_reference', ...(row.exam_number ? [] : ['exam_number'])],
        });
      }
    }

    const byRound = [...byRoundMap.values()];
    const totals = byRound.reduce((acc, row) => ({
      totalPublishedResults: acc.totalPublishedResults + row.totalPublishedResults,
      recoverableFromImport: acc.recoverableFromImport + row.recoverableFromImport,
      missingImportRows: acc.missingImportRows + row.missingImportRows,
    }), { totalPublishedResults: 0, recoverableFromImport: 0, missingImportRows: 0 });

    return {
      readOnly: true,
      schemaHas024Columns: hasPost024Columns,
      safeToApply: duplicatePublishedRounds.length === 0,
      duplicatePublishedRounds,
      unrecoverableSnapshots: {
        ...totals,
        missingDisplayDetailsOnlyCount: missingDisplayDetailsOnly.length,
        unverifiedCandidateOrAwardCount: unverifiedCandidateOrAward.length,
        missingDisplayDetailsOnly,
        unverifiedCandidateOrAward,
        byRound,
      },
      manualReviewForOcecTeam: unverifiedCandidateOrAward,
      pendingOwnerDecisions: [
        ...(duplicatePublishedRounds.length > 0 ? ['Result Owner must designate one approved reference batch per duplicate round before migration 024'] : []),
        ...(unverifiedCandidateOrAward.length > 0 ? ['OCEC team must verify unverifiedCandidateOrAward rows against original result sheets before mutating live data'] : []),
        ...(totals.missingImportRows > 0 ? ['BR-OPEN-03: Result Owner must confirm review & public display rule for legacy rows flagged snapshot_needs_review=true'] : []),
      ],
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Reconciles duplicate published batches for a single exam round using an explicit
 * Result Owner approved reference batch.
 *  - Preserves every superseded batch and its result_import_rows as immutable historical evidence.
 *  - Unpublishes stale results & deletes unclaimed final_invitations for items that were ONLY in
 *    a superseded batch (e.g. Old batch had [A, B], Approved batch has [A] -> B is removed from
 *    public results and cannot claim a new Final application).
 *  - Recomputes eligibility for items in the approved batch per BR-01 and updates snapshots when post-024 columns exist.
 */
export async function reconcileDuplicatePublishedBatches(
  { examRoundId, approvedBatchId, ownerApprovalNote, actorUserId = null, reason = 'duplicate_published_batch_reconciled' },
  pool = getPool(),
) {
  if (!examRoundId || !approvedBatchId) {
    throw Object.assign(new Error('examRoundId and approvedBatchId are required'), { statusCode: 400 });
  }
  const approvalNote = String(ownerApprovalNote || '').trim();
  if (approvalNote.length < 5) {
    throw Object.assign(new Error('ownerApprovalNote documenting Result Owner approval is required'), { statusCode: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`result:${examRoundId}`]);

    // Ensure superseded status and audit metadata columns exist cleanly even on pre-024 schemas.
    await client.query(`
      ALTER TABLE result_import_batches
        DROP CONSTRAINT IF EXISTS result_import_batches_status_check;
      ALTER TABLE result_import_batches
        ADD CONSTRAINT result_import_batches_status_check
        CHECK (status IN ('draft', 'published', 'superseded'));
      ALTER TABLE result_import_batches
        ADD COLUMN IF NOT EXISTS superseded_by_batch_id uuid REFERENCES result_import_batches(id),
        ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
        ADD COLUMN IF NOT EXISTS superseded_reason text,
        ADD COLUMN IF NOT EXISTS owner_approval_note text;
    `);

    const snapshotColumnCheck = await client.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'results' AND column_name = 'published_batch_id'
    `);
    const hasPost024Columns = snapshotColumnCheck.rowCount > 0;

    const round = await client.query(`
      SELECT r.id, r.competition_id, r.round_type, r.year, r.title,
             c.short_name, c.name AS competition_name
      FROM exam_rounds r JOIN competitions c ON c.id = r.competition_id
      WHERE r.id = $1 FOR UPDATE OF r
    `, [examRoundId]);
    if (!round.rowCount) throw Object.assign(new Error(`Exam round not found: ${examRoundId}`), { statusCode: 404 });
    const examRound = round.rows[0];

    const batches = await client.query(`
      SELECT id, file_name, status, published_at, published_by
      FROM result_import_batches
      WHERE exam_round_id = $1 AND status = 'published'
      ORDER BY published_at DESC NULLS LAST, created_at DESC, id
      FOR UPDATE
    `, [examRoundId]);

    const approvedBatch = batches.rows.find((row) => row.id === approvedBatchId);
    if (!approvedBatch) {
      throw Object.assign(new Error(`Approved batch ${approvedBatchId} is not a published batch for ${examRoundId}`), { statusCode: 409 });
    }

    const toSupersede = batches.rows.filter((row) => row.id !== approvedBatchId);
    const supersededIds = toSupersede.map((row) => row.id);
    if (supersededIds.length) {
      await client.query(`
        UPDATE result_import_batches
        SET status = 'superseded',
            superseded_by_batch_id = $1,
            superseded_at = now(),
            superseded_reason = $2,
            owner_approval_note = $3
        WHERE id = ANY($4::uuid[])
      `, [approvedBatchId, reason, approvalNote, supersededIds]);
    }

    const evidenceCount = supersededIds.length
      ? (await client.query('SELECT count(*)::int AS total FROM result_import_rows WHERE batch_id = ANY($1::uuid[])', [supersededIds])).rows[0].total
      : 0;

    // Load verified rows belonging to the approved reference batch.
    const approvedRows = await client.query(`
      SELECT ir.application_item_id, ir.candidate_no, ir.grade, ir.school_name, ir.candidate_name, ir.award,
             g.sort_order AS grade_sort_order,
             concat_ws(' ', nullif(ap.first_name_th, ''), nullif(ap.last_name_th, '')) AS candidate_name_th
      FROM result_import_rows ir
      JOIN application_items ai ON ai.id = ir.application_item_id
      JOIN applications a ON a.id = ai.application_id
      JOIN applicants ap ON ap.id = a.applicant_id
      JOIN grade_catalog g ON g.id = ai.grade_id
      WHERE ir.batch_id = $1 AND ir.application_item_id IS NOT NULL
      ORDER BY ir.row_number
    `, [approvedBatchId]);

    const approvedItemIds = approvedRows.rows.map((row) => row.application_item_id);

    // Unpublish stale results & remove unclaimed Final invitations for items in this round NOT present in the approved batch.
    const staleResults = await client.query(`
      SELECT res.application_item_id
      FROM results res
      JOIN application_items ai ON ai.id = res.application_item_id
      WHERE ai.exam_round_id = $1
        AND NOT (res.application_item_id = ANY($2::uuid[]))
    `, [examRoundId, approvedItemIds]);
    const unpublishedItemIds = staleResults.rows.map((row) => row.application_item_id);

    let alreadyClaimedSupersededItems = [];
    if (unpublishedItemIds.length) {
      const claimedCheck = await client.query(`
        SELECT heat_application_item_id, claimed_application_id
        FROM final_invitations
        WHERE heat_application_item_id = ANY($1::uuid[]) AND claimed_application_id IS NOT NULL
      `, [unpublishedItemIds]);
      alreadyClaimedSupersededItems = claimedCheck.rows.map((row) => ({
        applicationItemId: row.heat_application_item_id,
        claimedApplicationId: row.claimed_application_id,
      }));

      await client.query(`
        DELETE FROM final_verification_grants
        WHERE heat_application_item_id = ANY($1::uuid[]) AND claimed_at IS NULL
      `, [unpublishedItemIds]);

      await client.query(`
        DELETE FROM final_invitations
        WHERE heat_application_item_id = ANY($1::uuid[]) AND claimed_application_id IS NULL
      `, [unpublishedItemIds]);

      if (hasPost024Columns) {
        await client.query(`
          UPDATE results
          SET published_at = NULL, eligible_for_final = false, published_batch_id = NULL
          WHERE application_item_id = ANY($1::uuid[])
        `, [unpublishedItemIds]);
      } else {
        await client.query(`
          UPDATE results
          SET published_at = NULL, eligible_for_final = false
          WHERE application_item_id = ANY($1::uuid[])
        `, [unpublishedItemIds]);
      }
    }

    // Align results & Final invitations for items IN the approved batch per BR-01.
    const eligibleApprovedItemIds = [];
    const ineligibleApprovedItemIds = [];
    for (const row of approvedRows.rows) {
      const eligible = isEligibleForNextRound(row.award, examRound.competition_id, examRound.round_type);
      if (eligible) eligibleApprovedItemIds.push(row.application_item_id);
      else ineligibleApprovedItemIds.push(row.application_item_id);

      if (hasPost024Columns) {
        await client.query(`
          INSERT INTO results(
            application_item_id, award, eligible_for_final, published_at, published_by,
            published_batch_id, snapshot_exam_round_id, snapshot_competition_id,
            snapshot_competition_short_name, snapshot_competition_name, snapshot_competition_title,
            snapshot_year, snapshot_round_type, snapshot_candidate_no, snapshot_grade,
            snapshot_grade_sort_order, snapshot_school_name, snapshot_candidate_name,
            snapshot_candidate_name_th, snapshot_needs_review
          )
          VALUES($1,$2,$3,coalesce($4, now()),$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,false)
          ON CONFLICT (application_item_id) DO UPDATE SET
            award = excluded.award,
            eligible_for_final = excluded.eligible_for_final,
            published_at = coalesce(excluded.published_at, results.published_at, now()),
            published_by = coalesce(excluded.published_by, results.published_by),
            published_batch_id = excluded.published_batch_id,
            snapshot_exam_round_id = excluded.snapshot_exam_round_id,
            snapshot_competition_id = excluded.snapshot_competition_id,
            snapshot_competition_short_name = excluded.snapshot_competition_short_name,
            snapshot_competition_name = excluded.snapshot_competition_name,
            snapshot_competition_title = excluded.snapshot_competition_title,
            snapshot_year = excluded.snapshot_year,
            snapshot_round_type = excluded.snapshot_round_type,
            snapshot_candidate_no = excluded.snapshot_candidate_no,
            snapshot_grade = excluded.snapshot_grade,
            snapshot_grade_sort_order = excluded.snapshot_grade_sort_order,
            snapshot_school_name = excluded.snapshot_school_name,
            snapshot_candidate_name = excluded.snapshot_candidate_name,
            snapshot_candidate_name_th = excluded.snapshot_candidate_name_th,
            snapshot_needs_review = false
        `, [
          row.application_item_id,
          row.award,
          eligible,
          approvedBatch.published_at,
          approvedBatch.published_by,
          approvedBatchId,
          examRound.id,
          examRound.competition_id,
          examRound.short_name,
          examRound.competition_name,
          examRound.title,
          examRound.year,
          examRound.round_type,
          row.candidate_no,
          row.grade,
          row.grade_sort_order ?? 999,
          row.school_name,
          row.candidate_name,
          row.candidate_name_th || '',
        ]);
      } else {
        await client.query(`
          INSERT INTO results(application_item_id, award, eligible_for_final, published_at, published_by)
          VALUES($1, $2, $3, coalesce($4, now()), $5)
          ON CONFLICT (application_item_id) DO UPDATE SET
            award = excluded.award,
            eligible_for_final = excluded.eligible_for_final,
            published_at = coalesce(excluded.published_at, results.published_at, now()),
            published_by = coalesce(excluded.published_by, results.published_by)
        `, [row.application_item_id, row.award, eligible, approvedBatch.published_at, approvedBatch.published_by]);
      }
    }

    if (ineligibleApprovedItemIds.length) {
      await client.query(`
        DELETE FROM final_verification_grants
        WHERE heat_application_item_id = ANY($1::uuid[]) AND claimed_at IS NULL
      `, [ineligibleApprovedItemIds]);
      await client.query(`
        DELETE FROM final_invitations
        WHERE heat_application_item_id = ANY($1::uuid[]) AND claimed_application_id IS NULL
      `, [ineligibleApprovedItemIds]);
    }

    const nextRoundType = nextExamRoundType(examRound.competition_id, examRound.round_type);
    if (nextRoundType && eligibleApprovedItemIds.length) {
      const finals = await client.query(`
        SELECT id FROM exam_rounds
        WHERE active = true AND competition_id = $1 AND year = $2 AND round_type = $3
      `, [examRound.competition_id, examRound.year, nextRoundType]);
      for (const itemId of eligibleApprovedItemIds) {
        for (const finalRound of finals.rows) {
          await client.query(`
            INSERT INTO final_invitations(heat_application_item_id, final_exam_round_id)
            VALUES($1, $2) ON CONFLICT (heat_application_item_id, final_exam_round_id) DO NOTHING
          `, [itemId, finalRound.id]);
        }
      }
    }

    await client.query(`
      INSERT INTO audit_logs(actor_user_id, entity_type, entity_id, action, before_data, after_data)
      VALUES($1, 'exam_round', $2, 'reconcile_duplicate_published_batches', $3::jsonb, $4::jsonb)
    `, [
      actorUserId,
      examRoundId,
      JSON.stringify({ publishedBatchIds: batches.rows.map((row) => row.id) }),
      JSON.stringify({
        approvedBatchId,
        supersededBatchIds: supersededIds,
        preservedEvidenceRows: evidenceCount,
        unpublishedItemIds,
        alreadyClaimedSupersededItems,
        ownerApprovalNote: approvalNote,
        reason,
      }),
    ]);

    await client.query('COMMIT');
    return {
      examRoundId,
      approvedBatchId,
      supersededBatchIds: supersededIds,
      preservedEvidenceRows: evidenceCount,
      unpublishedItemIds,
      alreadyClaimedSupersededItems,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
