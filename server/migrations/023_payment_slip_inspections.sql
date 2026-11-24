CREATE TABLE IF NOT EXISTS payment_slip_inspections (
  payment_slip_id uuid NOT NULL REFERENCES payment_slips(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  slip_version integer NOT NULL CHECK (slip_version >= 1),
  inspector_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inspected_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  PRIMARY KEY (payment_slip_id, inspector_user_id)
);

CREATE INDEX IF NOT EXISTS payment_slip_inspections_payment_idx
  ON payment_slip_inspections (payment_id, inspector_user_id, slip_version DESC);
