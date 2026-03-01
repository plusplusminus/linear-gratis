-- Sync Health Monitor: logging tables for webhook events and sync runs
-- Epic 6: PPMLG-107

-- sync_events: logs every webhook event received from Linear
create table if not exists sync_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,        -- 'Issue', 'Comment', 'Project', 'Initiative'
  action text not null,            -- 'create', 'update', 'remove'
  entity_id text not null,         -- Linear entity ID
  team_id text,                    -- nullable for org-level entities (Initiative)
  status text not null default 'success',  -- 'success' | 'error' | 'skipped'
  error_message text,
  processing_time_ms integer,
  payload_summary jsonb,           -- lightweight metadata (title, identifier)
  created_at timestamptz not null default now()
);

-- sync_runs: logs every sync/reconcile operation
create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null,          -- 'initial_sync' | 'reconcile' | 'hub_sync'
  hub_id uuid references client_hubs(id) on delete set null,
  trigger text not null default 'manual',  -- 'manual' | 'cron' | 'api'
  status text not null default 'running',  -- 'running' | 'completed' | 'failed'
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  entities_processed jsonb default '{}'::jsonb,
  errors_count integer not null default 0,
  error_details jsonb,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for sync_events
create index idx_sync_events_created_at on sync_events (created_at);
create index idx_sync_events_event_type on sync_events (event_type);
create index idx_sync_events_status on sync_events (status);

-- Indexes for sync_runs
create index idx_sync_runs_created_at on sync_runs (created_at);
create index idx_sync_runs_status on sync_runs (status);
create index idx_sync_runs_hub_id on sync_runs (hub_id);
