-- Migration v2: Hybrid storage for sync tables
-- Stores full webhook/API payload as JSONB, with indexed columns for filtering.
--
-- Since there are no users yet, this is a clean drop + recreate.

DROP TABLE IF EXISTS notification_queue;
DROP TABLE IF EXISTS synced_comments;
DROP TABLE IF EXISTS synced_issues;
DROP TABLE IF EXISTS sync_subscriptions;

-- =============================================================================
-- synced_issues: Cached Linear issues
-- Indexed columns for filtering/sorting, `data` JSONB for full payload
-- =============================================================================
CREATE TABLE synced_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linear_id text NOT NULL,
  user_id text NOT NULL,
  identifier text NOT NULL,
  team_id text,
  project_id text,
  state_name text,
  priority integer DEFAULT 0,
  assignee_name text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_synced_issues_user_linear UNIQUE (user_id, linear_id)
);

CREATE INDEX idx_synced_issues_user_id ON synced_issues (user_id);
CREATE INDEX idx_synced_issues_linear_id ON synced_issues (linear_id);
CREATE INDEX idx_synced_issues_team_id ON synced_issues (team_id);
CREATE INDEX idx_synced_issues_project_id ON synced_issues (project_id);
CREATE INDEX idx_synced_issues_state_name ON synced_issues (state_name);

-- =============================================================================
-- synced_comments: Cached Linear issue comments
-- =============================================================================
CREATE TABLE synced_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linear_id text NOT NULL,
  issue_linear_id text NOT NULL,
  user_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_synced_comments_user_linear UNIQUE (user_id, linear_id)
);

CREATE INDEX idx_synced_comments_user_id ON synced_comments (user_id);
CREATE INDEX idx_synced_comments_linear_id ON synced_comments (linear_id);
CREATE INDEX idx_synced_comments_issue_linear_id ON synced_comments (issue_linear_id);

-- =============================================================================
-- sync_subscriptions: Webhook subscriptions per user/team (unchanged)
-- =============================================================================
CREATE TABLE sync_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  linear_team_id text NOT NULL,
  webhook_id text,
  webhook_secret text,
  events text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_subscriptions_user_id ON sync_subscriptions (user_id);
CREATE INDEX idx_sync_subscriptions_linear_team_id ON sync_subscriptions (linear_team_id);

-- =============================================================================
-- notification_queue: Queued notifications from webhook events (unchanged)
-- =============================================================================
CREATE TABLE notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  event_type text NOT NULL,
  issue_linear_id text,
  payload jsonb DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_queue_user_id ON notification_queue (user_id);
CREATE INDEX idx_notification_queue_sent_at ON notification_queue (sent_at)
  WHERE sent_at IS NULL;
