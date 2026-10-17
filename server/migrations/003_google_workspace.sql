CREATE TABLE google_workspace_connection (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton = true),
  account_email text NOT NULL,
  encrypted_refresh_token text NOT NULL,
  granted_scopes text[] NOT NULL DEFAULT '{}',
  connected_by uuid REFERENCES users(id),
  drive_root_folder_id text,
  slip_root_folder_id text,
  certificate_photo_root_folder_id text,
  spreadsheet_root_folder_id text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE google_workspace_oauth_attempts (
  state_hash text PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX google_workspace_oauth_attempts_expiry_idx ON google_workspace_oauth_attempts (expires_at);

CREATE TABLE google_workspace_spreadsheets (
  academic_year text PRIMARY KEY,
  drive_file_id text NOT NULL UNIQUE,
  title text NOT NULL,
  spreadsheet_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE google_workspace_sheet_tabs (
  exam_round_id text PRIMARY KEY REFERENCES exam_rounds(id) ON DELETE CASCADE,
  academic_year text NOT NULL REFERENCES google_workspace_spreadsheets(academic_year) ON DELETE CASCADE,
  sheet_id integer NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (academic_year, title)
);

CREATE TABLE google_workspace_sheet_rows (
  application_item_id uuid PRIMARY KEY REFERENCES application_items(id) ON DELETE CASCADE,
  exam_round_id text NOT NULL REFERENCES exam_rounds(id) ON DELETE CASCADE,
  spreadsheet_row integer NOT NULL CHECK (spreadsheet_row >= 2),
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_round_id, spreadsheet_row)
);
