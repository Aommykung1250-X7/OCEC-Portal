ALTER TABLE applications DROP CONSTRAINT applications_status_check;
ALTER TABLE applications ADD CONSTRAINT applications_status_check CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'slip_issue'));
ALTER TABLE school_batches DROP CONSTRAINT school_batches_status_check;
ALTER TABLE school_batches ADD CONSTRAINT school_batches_status_check CHECK (status IN ('draft', 'pending', 'partially_approved', 'approved', 'slip_issue'));
