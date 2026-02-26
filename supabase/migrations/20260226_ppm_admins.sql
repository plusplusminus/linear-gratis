-- Epic 2, Spec 2.6: PPMLG-75
-- PPM admin detection table

CREATE TABLE IF NOT EXISTS ppm_admins (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
