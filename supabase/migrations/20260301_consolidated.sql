-- =============================================================================
-- Consolidated Migration: 2026-03-01
-- Combines: drop_hub_branding, sync_monitoring (Epic 6), synced_cycles (Epic 7)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DROP HUB BRANDING (branding is no longer per-hub)
-- -----------------------------------------------------------------------------

ALTER TABLE client_hubs
  DROP COLUMN IF EXISTS logo_url,
  DROP COLUMN IF EXISTS primary_color,
  DROP COLUMN IF EXISTS accent_color,
  DROP COLUMN IF EXISTS footer_text;

-- -----------------------------------------------------------------------------
-- 2. SYNC HEALTH MONITOR (Epic 6: PPMLG-107)
-- -----------------------------------------------------------------------------

-- sync_events: logs every webhook event received from Linear
CREATE TABLE IF NOT EXISTS sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  action text NOT NULL,
  entity_id text NOT NULL,
  team_id text,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  processing_time_ms integer,
  payload_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- sync_runs: logs every sync/reconcile operation
CREATE TABLE IF NOT EXISTS sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text NOT NULL,
  hub_id uuid REFERENCES client_hubs(id) ON DELETE SET NULL,
  trigger text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  entities_processed jsonb DEFAULT '{}'::jsonb,
  errors_count integer NOT NULL DEFAULT 0,
  error_details jsonb,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_events_created_at ON sync_events (created_at);
CREATE INDEX idx_sync_events_event_type ON sync_events (event_type);
CREATE INDEX idx_sync_events_status ON sync_events (status);

CREATE INDEX idx_sync_runs_created_at ON sync_runs (created_at);
CREATE INDEX idx_sync_runs_status ON sync_runs (status);
CREATE INDEX idx_sync_runs_hub_id ON sync_runs (hub_id);

-- -----------------------------------------------------------------------------
-- 3. SYNCED CYCLES + DISPLAY NAME OVERRIDES (Epic 7: Cycle Support)
-- -----------------------------------------------------------------------------

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
