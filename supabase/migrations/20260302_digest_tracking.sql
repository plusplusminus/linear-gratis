-- Digest tracking columns for notification_preferences
-- Epic 9: PPMLG-148

ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS last_daily_digest_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_weekly_digest_at TIMESTAMPTZ;
