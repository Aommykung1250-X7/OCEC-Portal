CREATE TABLE IF NOT EXISTS catalog_revisions (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

INSERT INTO catalog_revisions (singleton, revision)
VALUES (true, 1)
ON CONFLICT (singleton) DO NOTHING;
