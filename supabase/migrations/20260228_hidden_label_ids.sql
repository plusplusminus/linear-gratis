-- Add hidden_label_ids to hub_team_mappings
-- Issues with any of these labels are entirely excluded from the client hub view.
ALTER TABLE hub_team_mappings
  ADD COLUMN hidden_label_ids TEXT[] NOT NULL DEFAULT '{}';
