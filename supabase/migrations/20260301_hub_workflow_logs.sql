create table if not exists hub_workflow_logs (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references client_hubs(id) on delete cascade,
  issue_linear_id text not null,
  rule_id uuid not null references hub_workflow_rules(id) on delete cascade,
  trigger_label_id text not null,
  action_type text not null,
  action_config jsonb not null default '{}',
  result text not null,  -- 'success' or 'failure'
  error_message text,
  triggered_by text not null,  -- user ID who changed the label
  created_at timestamptz not null default now()
);

create index if not exists idx_hub_workflow_logs_hub on hub_workflow_logs (hub_id);
create index if not exists idx_hub_workflow_logs_issue on hub_workflow_logs (issue_linear_id);
