ALTER TABLE exam_rounds
  ADD COLUMN active boolean NOT NULL DEFAULT true,
  ADD COLUMN final_confirm_close_date date,
  ADD COLUMN final_manually_closed boolean NOT NULL DEFAULT false,
  ADD COLUMN logo_data_url text;

ALTER TABLE exam_rounds
  ADD CONSTRAINT exam_round_logo_size CHECK (logo_data_url IS NULL OR length(logo_data_url) <= 7000000);

CREATE INDEX exam_rounds_active_year_idx ON exam_rounds(active, year DESC, title);
