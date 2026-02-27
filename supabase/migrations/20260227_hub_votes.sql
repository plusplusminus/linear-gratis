-- Hub votes: authenticated voting on roadmap items
create table hub_votes (
  id uuid primary key default gen_random_uuid(),
  hub_id uuid not null references client_hubs(id) on delete cascade,
  issue_linear_id text not null,
  user_id text not null,
  created_at timestamptz not null default now(),
  unique (hub_id, issue_linear_id, user_id)
);

create index idx_hub_votes_hub_issue on hub_votes (hub_id, issue_linear_id);
create index idx_hub_votes_hub_user on hub_votes (hub_id, user_id);
