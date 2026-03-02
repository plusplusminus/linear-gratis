-- Notification system tables for client hub portal
-- Epic 9: PPMLG-138

-- notification_events: stores all notification-worthy events for a hub
CREATE TABLE IF NOT EXISTS notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id uuid NOT NULL REFERENCES client_hubs(id) ON DELETE CASCADE,
  team_id text,
  event_type text NOT NULL CHECK (event_type IN ('comment', 'status_change', 'project_update', 'new_issue', 'cycle_update', 'initiative_update')),
  entity_type text NOT NULL,              -- 'issue', 'comment', 'project', 'cycle', 'initiative'
  entity_id text NOT NULL,
  actor_name text,
  summary text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_events_hub_created ON notification_events (hub_id, created_at DESC);
CREATE INDEX idx_notification_events_hub_team_created ON notification_events (hub_id, team_id, created_at DESC);
CREATE INDEX idx_notification_events_entity ON notification_events (entity_type, entity_id);

-- notification_preferences: per-user, per-hub, per-event-type delivery settings
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id uuid NOT NULL REFERENCES client_hubs(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('comment', 'status_change', 'project_update', 'new_issue', 'cycle_update', 'initiative_update')),
  in_app_enabled boolean DEFAULT true,
  email_mode text DEFAULT 'off' CHECK (email_mode IN ('off', 'immediate', 'daily', 'weekly')),
  digest_time text DEFAULT '09:00',
  timezone text DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hub_id, user_id, event_type)
);

CREATE INDEX idx_notification_preferences_user_hub ON notification_preferences (user_id, hub_id);

-- notification_reads: tracks which events a user has read
CREATE TABLE IF NOT EXISTS notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  notification_event_id uuid NOT NULL REFERENCES notification_events(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, notification_event_id)
);

CREATE INDEX idx_notification_reads_user ON notification_reads (user_id);

-- notification_email_queue: outbound email delivery queue (Resend integration)
CREATE TABLE IF NOT EXISTS notification_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_event_id uuid NOT NULL REFERENCES notification_events(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  hub_id uuid NOT NULL REFERENCES client_hubs(id) ON DELETE CASCADE,
  email_address text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  is_digest boolean DEFAULT false,
  resend_message_id text,
  error_message text,
  attempts integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX idx_notification_email_queue_status_created ON notification_email_queue (status, created_at);
CREATE INDEX idx_notification_email_queue_user_hub ON notification_email_queue (user_id, hub_id);
