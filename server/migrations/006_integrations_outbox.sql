ALTER TABLE integration_jobs
  ADD COLUMN dedupe_key text,
  ADD COLUMN locked_at timestamptz,
  ADD COLUMN completed_at timestamptz;

CREATE UNIQUE INDEX integration_jobs_dedupe_key_idx
  ON integration_jobs (dedupe_key) WHERE dedupe_key IS NOT NULL;

ALTER TABLE google_workspace_sheet_rows
  DROP CONSTRAINT IF EXISTS google_workspace_sheet_rows_exam_round_id_spreadsheet_row_key;

ALTER TABLE slip_replacement_tokens
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN revoked_at timestamptz;

CREATE INDEX slip_replacement_tokens_payment_idx
  ON slip_replacement_tokens (payment_id, expires_at DESC);
