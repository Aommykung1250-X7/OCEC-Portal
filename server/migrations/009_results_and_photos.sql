CREATE TABLE result_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_round_id text NOT NULL REFERENCES exam_rounds(id),
  file_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  imported_by uuid REFERENCES users(id),
  published_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE INDEX result_import_batches_round_idx ON result_import_batches(exam_round_id, created_at DESC);

CREATE TABLE result_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES result_import_batches(id) ON DELETE CASCADE,
  row_number integer NOT NULL CHECK (row_number > 0),
  candidate_no text NOT NULL,
  grade text NOT NULL,
  school_name text NOT NULL,
  candidate_name text NOT NULL,
  award text NOT NULL,
  application_item_id uuid REFERENCES application_items(id),
  match_status text NOT NULL CHECK (match_status IN ('matched', 'unmatched', 'duplicate', 'data_mismatch')),
  match_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, row_number)
);
CREATE INDEX result_import_rows_batch_idx ON result_import_rows(batch_id, row_number);
CREATE INDEX result_import_rows_candidate_no_idx ON result_import_rows(candidate_no);

CREATE TABLE final_id_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_round_id text NOT NULL REFERENCES exam_rounds(id),
  file_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'applied')),
  imported_by uuid REFERENCES users(id),
  applied_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz
);
CREATE INDEX final_id_import_batches_round_idx ON final_id_import_batches(exam_round_id, created_at DESC);

CREATE TABLE final_id_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES final_id_import_batches(id) ON DELETE CASCADE,
  row_number integer NOT NULL CHECK (row_number > 0),
  candidate_no text NOT NULL,
  grade text NOT NULL,
  school_name text NOT NULL,
  candidate_name text NOT NULL,
  application_item_id uuid REFERENCES application_items(id),
  match_status text NOT NULL CHECK (match_status IN ('matched', 'unmatched', 'duplicate', 'data_mismatch')),
  match_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, row_number)
);
CREATE INDEX final_id_import_rows_batch_idx ON final_id_import_rows(batch_id, row_number);

ALTER TABLE certificate_photos
  ADD COLUMN mime_type text NOT NULL DEFAULT 'image/jpeg',
  ADD COLUMN sha256 text,
  ADD COLUMN file_size integer,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX certificate_photos_item_idx ON certificate_photos(application_item_id);
CREATE UNIQUE INDEX application_items_exam_number_unique ON application_items(exam_round_id, exam_number) WHERE exam_number IS NOT NULL;
