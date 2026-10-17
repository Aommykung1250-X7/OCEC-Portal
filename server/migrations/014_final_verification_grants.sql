CREATE TABLE final_verification_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  final_invitation_id uuid NOT NULL REFERENCES final_invitations(id),
  heat_application_id uuid NOT NULL REFERENCES applications(id),
  heat_application_item_id uuid NOT NULL REFERENCES application_items(id),
  expires_at timestamptz NOT NULL,
  verified_user_id uuid REFERENCES users(id),
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX final_verification_grants_invitation_idx ON final_verification_grants(final_invitation_id, expires_at);
ALTER TABLE oauth_attempts ADD COLUMN final_verification_grant_id uuid REFERENCES final_verification_grants(id);
