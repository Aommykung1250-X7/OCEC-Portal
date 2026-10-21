CREATE TABLE google_workspace_mock_spreadsheets (
  academic_year text PRIMARY KEY,
  drive_file_id text NOT NULL UNIQUE,
  title text NOT NULL,
  spreadsheet_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE google_workspace_mock_sheet_tabs (
  academic_year text NOT NULL REFERENCES google_workspace_mock_spreadsheets(academic_year) ON DELETE CASCADE,
  competition text NOT NULL,
  sheet_id integer NOT NULL,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (academic_year, competition),
  UNIQUE (academic_year, title)
);
