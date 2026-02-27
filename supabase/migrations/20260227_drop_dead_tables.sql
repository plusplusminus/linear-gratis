-- Drop legacy sync infrastructure tables that are no longer used.
-- The workspace-level webhook model replaced per-user sync subscriptions,
-- and the notification queue was never used in production.

DROP TABLE IF EXISTS sync_subscriptions CASCADE;
DROP TABLE IF EXISTS notification_queue CASCADE;
