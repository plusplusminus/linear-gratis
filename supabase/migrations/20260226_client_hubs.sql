-- Client Hub tables for multi-tenant client portal
-- Epic 1, Spec 1.1: PPMLG-51

-- ============================================================
-- client_hubs: Tenant container, one per client
-- ============================================================
CREATE TABLE IF NOT EXISTS client_hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NOT NULL,              -- WorkOS user ID of PPM admin
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_hubs_slug ON client_hubs(slug);
CREATE INDEX idx_client_hubs_active ON client_hubs(is_active) WHERE is_active = true;

-- ============================================================
-- hub_team_mappings: Links hubs to Linear teams with scoping
-- ============================================================
CREATE TABLE IF NOT EXISTS hub_team_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id UUID NOT NULL REFERENCES client_hubs(id) ON DELETE CASCADE,
  linear_team_id TEXT NOT NULL,
  linear_team_name TEXT,                 -- Cached for display
  visible_project_ids TEXT[] NOT NULL DEFAULT '{}',     -- Empty = all visible
  visible_initiative_ids TEXT[] NOT NULL DEFAULT '{}',  -- Empty = all visible
  visible_label_ids TEXT[] NOT NULL DEFAULT '{}',       -- Empty = all visible
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_hub_team UNIQUE (hub_id, linear_team_id)
);

-- A Linear team can only belong to one hub (exclusive mapping)
CREATE UNIQUE INDEX idx_hub_team_mappings_team_exclusive
  ON hub_team_mappings(linear_team_id) WHERE is_active = true;

CREATE INDEX idx_hub_team_mappings_hub ON hub_team_mappings(hub_id);
CREATE INDEX idx_hub_team_mappings_team ON hub_team_mappings(linear_team_id);

-- ============================================================
-- hub_members: Links users to hubs with roles
-- ============================================================
CREATE TABLE IF NOT EXISTS hub_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id UUID NOT NULL REFERENCES client_hubs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,                 -- WorkOS user ID
  role TEXT NOT NULL DEFAULT 'default',  -- 'default' | 'view_only' | 'admin'
  invited_by TEXT,                       -- WorkOS user ID of inviter
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_hub_member UNIQUE (hub_id, user_id),
  CONSTRAINT chk_hub_member_role CHECK (role IN ('default', 'view_only', 'admin'))
);

CREATE INDEX idx_hub_members_hub ON hub_members(hub_id);
CREATE INDEX idx_hub_members_user ON hub_members(user_id);

-- ============================================================
-- hub_comments: Client user attribution for comments pushed to Linear
-- ============================================================
CREATE TABLE IF NOT EXISTS hub_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id UUID NOT NULL REFERENCES client_hubs(id) ON DELETE CASCADE,
  issue_linear_id TEXT NOT NULL,
  linear_comment_id TEXT,               -- Set after comment is created in Linear
  author_user_id TEXT NOT NULL,         -- WorkOS user ID of client user
  author_name TEXT NOT NULL,            -- Display name at time of comment
  author_email TEXT,                    -- Email at time of comment
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hub_comments_hub ON hub_comments(hub_id);
CREATE INDEX idx_hub_comments_issue ON hub_comments(issue_linear_id);
CREATE INDEX idx_hub_comments_author ON hub_comments(author_user_id);
