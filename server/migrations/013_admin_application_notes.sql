CREATE TABLE application_admin_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES applications(id),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 4000),
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX application_admin_notes_application_idx
  ON application_admin_notes(application_id, created_at, id) WHERE deleted_at IS NULL;

CREATE TABLE application_admin_note_history (
  id bigserial PRIMARY KEY,
  note_id uuid NOT NULL REFERENCES application_admin_notes(id),
  application_id uuid NOT NULL REFERENCES applications(id),
  actor_user_id uuid NOT NULL REFERENCES users(id),
  action text NOT NULL CHECK (action IN ('create', 'edit', 'delete')),
  before_body text,
  after_body text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX application_admin_note_history_application_idx
  ON application_admin_note_history(application_id, id);

CREATE FUNCTION prevent_application_admin_note_history_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Application admin note history is immutable';
END;
$$;

CREATE TRIGGER application_admin_note_history_immutable
  BEFORE UPDATE OR DELETE ON application_admin_note_history
  FOR EACH ROW EXECUTE FUNCTION prevent_application_admin_note_history_mutation();
