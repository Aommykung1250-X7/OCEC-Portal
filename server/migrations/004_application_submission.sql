ALTER TABLE applicants ADD COLUMN gender text;
ALTER TABLE applicants ADD COLUMN certificate_school_name text;
ALTER TABLE applications ADD COLUMN marketing_consent boolean NOT NULL DEFAULT false;
ALTER TABLE applications ADD COLUMN review_note text;

-- Temporary durable receipt storage until Google Drive upload is wired into the submission flow.
ALTER TABLE payment_slips ADD COLUMN content_bytes bytea;
ALTER TABLE payment_slips ADD COLUMN sha256 text;
