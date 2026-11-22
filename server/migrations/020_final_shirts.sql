ALTER TABLE application_items ADD COLUMN shirt_size text
  CHECK (shirt_size IN ('SS','S','M','L','XL','2XL','3XL','4XL','5XL'));

CREATE TABLE final_shirt_images (
  kind text PRIMARY KEY CHECK (kind IN ('chart','sample')),
  mime_type text NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp')),
  content_bytes bytea NOT NULL CHECK (octet_length(content_bytes) BETWEEN 1 AND 5242880),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid NOT NULL REFERENCES users(id)
);
