-- OCEC-04: Safe upgrade migration for immutable published result snapshots and single active published batch per round.
-- Preserves superseded historical batches as immutable evidence when reconciled with result owner approval.

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

-- Guard: refuse to silently pick a winner or fail cryptically if legacy data has duplicate published batches.
DO $$
DECLARE
  duplicate_rounds text;
BEGIN
  SELECT string_agg(exam_round_id || ' (' || cnt::text || ' batches)', ', ' ORDER BY exam_round_id)
  INTO duplicate_rounds
  FROM (
    SELECT exam_round_id, count(*) AS cnt
    FROM result_import_batches
    WHERE status = 'published'
    GROUP BY exam_round_id
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_rounds IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 024 blocked: duplicate published result batches found for exam_round_id(s): %. Run "npm run db:preflight:024" and reconcile duplicate rounds with result owner approval (marking non-reference batches as superseded) before retrying.', duplicate_rounds;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS result_import_batches_one_published_per_round
  ON result_import_batches (exam_round_id)
  WHERE status = 'published';

ALTER TABLE results
  ADD COLUMN IF NOT EXISTS published_batch_id uuid REFERENCES result_import_batches(id),
  ADD COLUMN IF NOT EXISTS snapshot_exam_round_id text,
  ADD COLUMN IF NOT EXISTS snapshot_competition_id text,
  ADD COLUMN IF NOT EXISTS snapshot_competition_short_name text,
  ADD COLUMN IF NOT EXISTS snapshot_competition_name text,
  ADD COLUMN IF NOT EXISTS snapshot_competition_title text,
  ADD COLUMN IF NOT EXISTS snapshot_year text,
  ADD COLUMN IF NOT EXISTS snapshot_round_type text,
  ADD COLUMN IF NOT EXISTS snapshot_candidate_no text,
  ADD COLUMN IF NOT EXISTS snapshot_grade text,
  ADD COLUMN IF NOT EXISTS snapshot_grade_sort_order integer,
  ADD COLUMN IF NOT EXISTS snapshot_school_name text,
  ADD COLUMN IF NOT EXISTS snapshot_candidate_name text,
  ADD COLUMN IF NOT EXISTS snapshot_candidate_name_th text,
  ADD COLUMN IF NOT EXISTS snapshot_needs_review boolean NOT NULL DEFAULT false;

-- 1) Backfill published results from their verified active published import batch first.
UPDATE results res
SET published_batch_id = src.batch_id,
    snapshot_exam_round_id = src.exam_round_id,
    snapshot_competition_id = src.competition_id,
    snapshot_competition_short_name = src.short_name,
    snapshot_competition_name = src.competition_name,
    snapshot_competition_title = src.round_title,
    snapshot_year = src.year,
    snapshot_round_type = src.round_type,
    snapshot_candidate_no = src.candidate_no,
    snapshot_grade = src.grade,
    snapshot_grade_sort_order = src.grade_sort_order,
    snapshot_school_name = src.school_name,
    snapshot_candidate_name = src.candidate_name,
    snapshot_candidate_name_th = src.candidate_name_th,
    snapshot_needs_review = false
FROM (
  SELECT DISTINCT ON (ir.application_item_id)
    ir.application_item_id,
    b.id AS batch_id,
    r.id AS exam_round_id,
    r.competition_id,
    c.short_name,
    c.name AS competition_name,
    r.title AS round_title,
    r.year,
    r.round_type,
    ir.candidate_no,
    ir.grade,
    g.sort_order AS grade_sort_order,
    ir.school_name,
    ir.candidate_name,
    concat_ws(' ', nullif(ap.first_name_th, ''), nullif(ap.last_name_th, '')) AS candidate_name_th
  FROM result_import_rows ir
  JOIN result_import_batches b ON b.id = ir.batch_id AND b.status = 'published'
  JOIN application_items ai ON ai.id = ir.application_item_id
  JOIN applications a ON a.id = ai.application_id
  JOIN applicants ap ON ap.id = a.applicant_id
  JOIN grade_catalog g ON g.id = ai.grade_id
  JOIN exam_rounds r ON r.id = b.exam_round_id
  JOIN competitions c ON c.id = r.competition_id
  WHERE ir.application_item_id IS NOT NULL
  ORDER BY ir.application_item_id, b.published_at DESC NULLS LAST, b.created_at DESC
) src
WHERE res.application_item_id = src.application_item_id
  AND res.published_at IS NOT NULL
  AND res.snapshot_candidate_name IS NULL;

-- 2) Backfill any remaining published results that lacked a published import row and flag them for owner review (BR-OPEN-03).
UPDATE results res
SET snapshot_exam_round_id = r.id,
    snapshot_competition_id = r.competition_id,
    snapshot_competition_short_name = c.short_name,
    snapshot_competition_name = c.name,
    snapshot_competition_title = r.title,
    snapshot_year = r.year,
    snapshot_round_type = r.round_type,
    snapshot_candidate_no = coalesce(ai.exam_number, ''),
    snapshot_grade = g.label,
    snapshot_grade_sort_order = g.sort_order,
    snapshot_school_name = ap.school_name,
    snapshot_candidate_name = concat_ws(' ', ap.first_name_en, nullif(ap.middle_name_en, ''), ap.last_name_en),
    snapshot_candidate_name_th = concat_ws(' ', nullif(ap.first_name_th, ''), nullif(ap.last_name_th, '')),
    snapshot_needs_review = true
FROM application_items ai
JOIN applications a ON a.id = ai.application_id
JOIN applicants ap ON ap.id = a.applicant_id
JOIN grade_catalog g ON g.id = ai.grade_id
JOIN exam_rounds r ON r.id = ai.exam_round_id
JOIN competitions c ON c.id = r.competition_id
WHERE res.application_item_id = ai.id
  AND res.published_at IS NOT NULL
  AND res.snapshot_candidate_name IS NULL;
