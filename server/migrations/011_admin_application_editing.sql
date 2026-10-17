ALTER TABLE applications
  ADD COLUMN non_refundable_adjustment_satang integer NOT NULL DEFAULT 0
    CHECK (non_refundable_adjustment_satang >= 0);

ALTER TABLE applications DROP COLUMN total_satang;
ALTER TABLE applications ADD COLUMN total_satang integer
  GENERATED ALWAYS AS (registration_total_satang + paper_total_satang + non_refundable_adjustment_satang) STORED;

ALTER TABLE application_items ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE application_item_exam_number_history (
  id bigserial PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  application_item_id uuid NOT NULL,
  exam_round_id text NOT NULL REFERENCES exam_rounds(id),
  center_id text NOT NULL REFERENCES exam_centers(id),
  exam_number text NOT NULL,
  reason text NOT NULL,
  previous_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  canceled_by uuid NOT NULL REFERENCES users(id),
  canceled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_round_id, exam_number)
);

CREATE INDEX application_item_number_history_scope_idx
  ON application_item_exam_number_history(exam_round_id, center_id, exam_number);
