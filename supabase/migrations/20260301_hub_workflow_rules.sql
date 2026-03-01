-- Hub workflow rules: automate status changes based on label events
create table if not exists hub_workflow_rules (
  id uuid primary key default gen_random_uuid(),
  mapping_id uuid not null references hub_team_mappings(id) on delete cascade,
  trigger_type text not null,
  trigger_label_id text not null,
  trigger_from_label_id text,
  action_type text not null,
  action_config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_trigger_type check (trigger_type in ('label_added', 'label_removed', 'label_changed')),
  constraint chk_action_type check (action_type in ('set_status'))
);

create index if not exists idx_hub_workflow_rules_mapping on hub_workflow_rules (mapping_id);
