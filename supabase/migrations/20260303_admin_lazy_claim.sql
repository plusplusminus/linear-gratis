-- Epic 13, Spec 1: PPMLG-172
-- Enable lazy-claim pattern for ppm_admins (add by email, claim user_id on first login)
-- Also tighten hub_members.role constraint to remove unused 'admin' value

-- 1. Add UUID primary key to ppm_admins (replacing user_id as PK)
ALTER TABLE ppm_admins ADD COLUMN id UUID DEFAULT gen_random_uuid();
UPDATE ppm_admins SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE ppm_admins DROP CONSTRAINT ppm_admins_pkey;
ALTER TABLE ppm_admins ADD PRIMARY KEY (id);

-- 2. Make user_id nullable (null until first login for email-only invites)
ALTER TABLE ppm_admins ALTER COLUMN user_id DROP NOT NULL;
CREATE UNIQUE INDEX idx_ppm_admins_user_id ON ppm_admins(user_id) WHERE user_id IS NOT NULL;

-- 3. Ensure email uniqueness
ALTER TABLE ppm_admins ADD CONSTRAINT uq_ppm_admins_email UNIQUE (email);

-- 4. Tighten hub_members.role constraint (remove 'admin' — it's synthetic, never stored)
ALTER TABLE hub_members DROP CONSTRAINT chk_hub_member_role;
ALTER TABLE hub_members ADD CONSTRAINT chk_hub_member_role CHECK (role IN ('default', 'view_only'));
