-- Epic 2, Spec 2.3: PPMLG-63
-- Enhance hub_members for email-first invite flow

-- user_id becomes nullable (filled on first login)
ALTER TABLE hub_members ALTER COLUMN user_id DROP NOT NULL;

-- Add email and invite tracking
ALTER TABLE hub_members
  ADD COLUMN email TEXT,
  ADD COLUMN workos_invitation_id TEXT;

-- Email uniqueness per hub (only one invite per email per hub)
CREATE UNIQUE INDEX idx_hub_members_hub_email
  ON hub_members(hub_id, email) WHERE email IS NOT NULL;
