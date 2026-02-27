-- Hub comments: client-authored comments pushed to Linear
CREATE TABLE IF NOT EXISTS hub_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id uuid NOT NULL REFERENCES client_hubs(id) ON DELETE CASCADE,
  issue_linear_id text NOT NULL,
  user_id text NOT NULL,
  author_name text NOT NULL,
  author_email text,
  body text NOT NULL,
  linear_comment_id text,
  push_status text NOT NULL DEFAULT 'pending',
  push_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hub_comments_issue ON hub_comments (issue_linear_id);
CREATE INDEX IF NOT EXISTS idx_hub_comments_hub ON hub_comments (hub_id);
CREATE INDEX IF NOT EXISTS idx_hub_comments_push_pending ON hub_comments (push_status) WHERE push_status != 'pushed';
