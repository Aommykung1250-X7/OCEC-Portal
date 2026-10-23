CREATE TABLE application_center_poster (
  id smallint PRIMARY KEY CHECK (id = 1),
  mime_type text NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  content_bytes bytea NOT NULL CHECK (octet_length(content_bytes) BETWEEN 1 AND 5242880),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES users(id)
);
