-- =============================================================================
-- Synced Cycles + Cycle Display Name Overrides
-- Epic 7: Cycle Support
-- =============================================================================

-- 1. SYNCED CYCLES (hybrid JSONB storage, same pattern as synced_projects)
CREATE TABLE IF NOT EXISTS synced_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linear_id text NOT NULL,
  user_id text NOT NULL,
  name text,
  number integer,
  team_id text NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_synced_cycles_user_linear UNIQUE (user_id, linear_id)
);

CREATE INDEX IF NOT EXISTS idx_synced_cycles_user_id ON synced_cycles (user_id);
CREATE INDEX IF NOT EXISTS idx_synced_cycles_linear_id ON synced_cycles (linear_id);
CREATE INDEX IF NOT EXISTS idx_synced_cycles_team_id ON synced_cycles (team_id);
CREATE INDEX IF NOT EXISTS idx_synced_cycles_number ON synced_cycles (number);
CREATE INDEX IF NOT EXISTS idx_synced_cycles_starts_at ON synced_cycles (starts_at);
CREATE INDEX IF NOT EXISTS idx_synced_cycles_ends_at ON synced_cycles (ends_at);

-- 2. CYCLE DISPLAY NAME OVERRIDES (per-hub custom names)
CREATE TABLE IF NOT EXISTS cycle_display_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id uuid NOT NULL REFERENCES client_hubs(id) ON DELETE CASCADE,
  cycle_linear_id text NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_cycle_display_name UNIQUE (hub_id, cycle_linear_id)
);

CREATE INDEX IF NOT EXISTS idx_cycle_display_names_hub ON cycle_display_names (hub_id);
CREATE INDEX IF NOT EXISTS idx_cycle_display_names_cycle ON cycle_display_names (cycle_linear_id);
