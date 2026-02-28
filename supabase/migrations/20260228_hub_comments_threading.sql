-- Add threading support to hub_comments
-- parent_comment_id stores a Linear comment ID (not hub_comments UUID)
-- because the parent may be a synced Linear comment (synced_comments.linear_id)
ALTER TABLE hub_comments ADD COLUMN IF NOT EXISTS parent_comment_id text;

CREATE INDEX IF NOT EXISTS idx_hub_comments_parent ON hub_comments (parent_comment_id) WHERE parent_comment_id IS NOT NULL;
