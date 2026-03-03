-- Add auto_include_projects flag and overview_only_project_ids to hub_team_mappings
-- auto_include_projects: when true, all projects for this team are visible (ignores visible_project_ids)
-- overview_only_project_ids: projects that show description/updates but not issues

ALTER TABLE hub_team_mappings
  ADD COLUMN IF NOT EXISTS auto_include_projects BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS overview_only_project_ids TEXT[] NOT NULL DEFAULT '{}';

-- Data migration: existing mappings with empty visible_project_ids were implicitly "all visible"
-- Set auto_include_projects = true to preserve that behavior explicitly
UPDATE hub_team_mappings
SET auto_include_projects = true
WHERE visible_project_ids = '{}' OR visible_project_ids IS NULL;
