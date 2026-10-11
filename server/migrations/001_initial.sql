CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub text NOT NULL UNIQUE,
  email text NOT NULL,
  display_name text NOT NULL,
  picture_url text,
  is_admin boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);

CREATE TABLE oauth_attempts (
  state_hash text PRIMARY KEY,
  nonce text NOT NULL,
  code_verifier text NOT NULL,
  return_path text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE competitions (
  id text PRIMARY KEY,
  short_name text NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE grade_catalog (
  id text PRIMARY KEY,
  label text NOT NULL UNIQUE,
  sort_order integer NOT NULL,
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE exam_centers (
  id text PRIMARY KEY,
  code char(3) NOT NULL UNIQUE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT exam_centers_code_format CHECK (code ~ '^[0-9]{3}$')
);
CREATE TABLE exam_rounds (
  id text PRIMARY KEY,
  competition_id text NOT NULL REFERENCES competitions(id),
  title text NOT NULL,
  year text NOT NULL,
  round_type text NOT NULL CHECK (round_type IN ('HEAT', 'FINAL', 'FINAL_X')),
  open_date date,
  close_date date,
  edit_close_date date,
  exam_date date,
  exam_start_time time,
  exam_end_time time,
  is_open boolean NOT NULL DEFAULT false,
  accent text,
  paper_price_satang integer NOT NULL DEFAULT 0 CHECK (paper_price_satang >= 0),
  online_price_satang integer NOT NULL DEFAULT 0 CHECK (online_price_satang >= 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exam_round_date_order CHECK (open_date IS NULL OR close_date IS NULL OR open_date <= close_date)
);
CREATE TABLE exam_round_grades (
  exam_round_id text NOT NULL REFERENCES exam_rounds(id) ON DELETE CASCADE,
  grade_id text NOT NULL REFERENCES grade_catalog(id),
  PRIMARY KEY (exam_round_id, grade_id)
);
CREATE TABLE exam_round_centers (
  exam_round_id text NOT NULL REFERENCES exam_rounds(id) ON DELETE CASCADE,
  center_id text NOT NULL REFERENCES exam_centers(id),
  PRIMARY KEY (exam_round_id, center_id)
);
CREATE TABLE past_papers (
  id text PRIMARY KEY,
  competition_id text REFERENCES competitions(id),
  group_name text NOT NULL,
  title text NOT NULL,
  detail text NOT NULL DEFAULT '',
  price_satang integer NOT NULL CHECK (price_satang >= 0),
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE payment_accounts (
  id text PRIMARY KEY,
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  category text NOT NULL CHECK (category IN ('president', 'other')),
  show_in_form boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE school_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinator_user_id uuid NOT NULL REFERENCES users(id),
  coordinator_email text NOT NULL,
  school_name text NOT NULL,
  source text NOT NULL CHECK (source IN ('manual', 'excel')),
  total_satang integer NOT NULL CHECK (total_satang >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_approved', 'approved', 'slip_issue')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name_en text NOT NULL,
  middle_name_en text NOT NULL DEFAULT '',
  last_name_en text NOT NULL,
  first_name_th text,
  last_name_th text,
  date_of_birth date NOT NULL,
  school_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text NOT NULL,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES applicants(id),
  owner_user_id uuid NOT NULL REFERENCES users(id),
  school_batch_id uuid REFERENCES school_batches(id),
  source text NOT NULL CHECK (source IN ('self', 'school', 'guest', 'final')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'slip_issue')),
  registration_total_satang integer NOT NULL CHECK (registration_total_satang >= 0),
  paper_total_satang integer NOT NULL DEFAULT 0 CHECK (paper_total_satang >= 0),
  total_satang integer GENERATED ALWAYS AS (registration_total_satang + paper_total_satang) STORED,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES users(id),
  source_heat_application_id uuid REFERENCES applications(id),
  version integer NOT NULL DEFAULT 1
);
CREATE INDEX applications_owner_idx ON applications (owner_user_id, submitted_at DESC);
CREATE INDEX applications_status_idx ON applications (status, submitted_at);
CREATE INDEX applications_batch_idx ON applications (school_batch_id);
CREATE TABLE application_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  exam_round_id text NOT NULL REFERENCES exam_rounds(id),
  grade_id text NOT NULL REFERENCES grade_catalog(id),
  format text NOT NULL CHECK (format IN ('paper', 'online')),
  center_id text NOT NULL REFERENCES exam_centers(id),
  online_exam_email text,
  fee_satang integer NOT NULL CHECK (fee_satang >= 0),
  snapshot jsonb NOT NULL,
  duplicate_key text NOT NULL UNIQUE,
  exam_number text,
  UNIQUE (application_id, exam_round_id),
  CONSTRAINT online_email_required CHECK (format <> 'online' OR online_exam_email IS NOT NULL)
);
CREATE TABLE application_past_papers (
  application_id uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  past_paper_id text NOT NULL REFERENCES past_papers(id),
  price_satang integer NOT NULL CHECK (price_satang >= 0),
  snapshot jsonb NOT NULL,
  PRIMARY KEY (application_id, past_paper_id)
);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES applications(id),
  school_batch_id uuid REFERENCES school_batches(id),
  payment_account_id text REFERENCES payment_accounts(id),
  expected_satang integer NOT NULL CHECK (expected_satang >= 0),
  confirmed_satang integer CHECK (confirmed_satang >= 0),
  confirmed_transfer_at timestamptz,
  confirmed_account_number text,
  confirmed_by uuid REFERENCES users(id),
  confirmed_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'slip_issue')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_single_owner CHECK ((application_id IS NULL) <> (school_batch_id IS NULL))
);
CREATE TABLE payment_slips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id),
  drive_file_id text,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  ocr_suggestion jsonb,
  version integer NOT NULL DEFAULT 1,
  uploaded_by uuid REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE slip_replacement_tokens (
  token_hash text PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES payments(id),
  recipient_email text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
CREATE TABLE certificate_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_item_id uuid NOT NULL REFERENCES application_items(id),
  drive_file_id text NOT NULL,
  file_name text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES users(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  replaced_at timestamptz,
  UNIQUE (application_item_id)
);
CREATE TABLE results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_item_id uuid NOT NULL UNIQUE REFERENCES application_items(id),
  award text NOT NULL,
  eligible_for_final boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  published_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE final_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heat_application_item_id uuid NOT NULL REFERENCES application_items(id),
  final_exam_round_id text NOT NULL REFERENCES exam_rounds(id),
  claimed_application_id uuid REFERENCES applications(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (heat_application_item_id, final_exam_round_id)
);
CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE TABLE integration_jobs (
  id bigserial PRIMARY KEY,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX integration_jobs_ready_idx ON integration_jobs (next_attempt_at, id) WHERE status IN ('pending', 'failed');
