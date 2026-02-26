-- Migration: Add sync tables for Teams, Projects, and Initiatives
-- Follows hybrid storage pattern: indexed columns for filtering + data JSONB for full payload

-- =============================================================================
-- synced_teams: Cached Linear teams (including sub-teams)
-- No webhook events for teams — synced via initial sync + reconciliation only
-- =============================================================================
CREATE TABLE synced_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linear_id text NOT NULL,
  user_id text NOT NULL,
  name text NOT NULL,
  key text,
  parent_team_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_synced_teams_user_linear UNIQUE (user_id, linear_id)
);

CREATE INDEX idx_synced_teams_user_id ON synced_teams (user_id);
CREATE INDEX idx_synced_teams_linear_id ON synced_teams (linear_id);
CREATE INDEX idx_synced_teams_parent_team_id ON synced_teams (parent_team_id);

-- =============================================================================
-- synced_projects: Cached Linear projects
-- Projects can span multiple teams — no single team_id column
-- =============================================================================
CREATE TABLE synced_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linear_id text NOT NULL,
  user_id text NOT NULL,
  name text NOT NULL,
  status_name text,
  lead_name text,
  priority integer DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_synced_projects_user_linear UNIQUE (user_id, linear_id)
);

CREATE INDEX idx_synced_projects_user_id ON synced_projects (user_id);
CREATE INDEX idx_synced_projects_linear_id ON synced_projects (linear_id);
CREATE INDEX idx_synced_projects_status_name ON synced_projects (status_name);

-- =============================================================================
-- synced_initiatives: Cached Linear initiatives (org-level)
-- =============================================================================
CREATE TABLE synced_initiatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linear_id text NOT NULL,
  user_id text NOT NULL,
  name text NOT NULL,
  status text,
  owner_name text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_synced_initiatives_user_linear UNIQUE (user_id, linear_id)
);

CREATE INDEX idx_synced_initiatives_user_id ON synced_initiatives (user_id);
CREATE INDEX idx_synced_initiatives_linear_id ON synced_initiatives (linear_id);
CREATE INDEX idx_synced_initiatives_status ON synced_initiatives (status);
