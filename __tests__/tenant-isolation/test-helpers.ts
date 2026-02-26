/**
 * Test helpers for tenant isolation tests.
 * Provides mock data factories and assertion helpers.
 */

export const HUB_1 = {
  id: "hub-1-id",
  name: "Client Alpha",
  slug: "client-alpha",
  workos_org_id: "org_alpha",
  is_active: true,
  created_by: "admin-user-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

export const HUB_2 = {
  id: "hub-2-id",
  name: "Client Beta",
  slug: "client-beta",
  workos_org_id: "org_beta",
  is_active: true,
  created_by: "admin-user-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

export const TEAM_A = { linear_team_id: "team-a-id" }; // belongs to Hub 1
export const TEAM_B = { linear_team_id: "team-b-id" }; // belongs to Hub 2

export const MAPPING_HUB1_TEAM_A = {
  id: "mapping-1",
  hub_id: HUB_1.id,
  linear_team_id: TEAM_A.linear_team_id,
  linear_team_name: "Team A",
  visible_project_ids: [] as string[],
  visible_initiative_ids: [] as string[],
  visible_label_ids: [] as string[],
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

export const MAPPING_HUB2_TEAM_B = {
  id: "mapping-2",
  hub_id: HUB_2.id,
  linear_team_id: TEAM_B.linear_team_id,
  linear_team_name: "Team B",
  visible_project_ids: [] as string[],
  visible_initiative_ids: [] as string[],
  visible_label_ids: [] as string[],
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

export const USER_HUB1 = {
  id: "user-hub1",
  email: "alice@alpha.com",
  firstName: "Alice",
  lastName: "Alpha",
};

export const USER_HUB2 = {
  id: "user-hub2",
  email: "bob@beta.com",
  firstName: "Bob",
  lastName: "Beta",
};

export const PPM_ADMIN = {
  id: "ppm-admin-1",
  email: "admin@ppm.com",
  firstName: "Admin",
  lastName: "PPM",
};

export const MEMBER_HUB1_DEFAULT = {
  id: "member-1",
  hub_id: HUB_1.id,
  user_id: USER_HUB1.id,
  email: USER_HUB1.email,
  role: "default",
  invited_by: PPM_ADMIN.id,
  workos_invitation_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

export const MEMBER_HUB1_VIEWONLY = {
  id: "member-1-vo",
  hub_id: HUB_1.id,
  user_id: "user-hub1-viewonly",
  email: "viewer@alpha.com",
  role: "view_only",
  invited_by: PPM_ADMIN.id,
  workos_invitation_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

export const MEMBER_HUB2_DEFAULT = {
  id: "member-2",
  hub_id: HUB_2.id,
  user_id: USER_HUB2.id,
  email: USER_HUB2.email,
  role: "default",
  invited_by: PPM_ADMIN.id,
  workos_invitation_id: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

// Sample synced issues
export const ISSUE_TEAM_A = {
  linear_id: "issue-a-1",
  user_id: "workspace",
  team_id: TEAM_A.linear_team_id,
  project_id: "proj-a-1",
  state_name: "In Progress",
  data: {
    id: "issue-a-1",
    identifier: "ALPHA-1",
    title: "Issue in Team A",
    priority: 2,
    state: { id: "s1", name: "In Progress", color: "#f00", type: "started" },
    assignee: { id: "dev-1", name: "Developer One" },
    labels: [
      { id: "label-1", name: "Bug", color: "#ff0000" },
      { id: "label-2", name: "Internal", color: "#000000" },
    ],
  },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

export const ISSUE_TEAM_B = {
  linear_id: "issue-b-1",
  user_id: "workspace",
  team_id: TEAM_B.linear_team_id,
  project_id: "proj-b-1",
  state_name: "Todo",
  data: {
    id: "issue-b-1",
    identifier: "BETA-1",
    title: "Issue in Team B",
    priority: 3,
    state: { id: "s2", name: "Todo", color: "#00f", type: "unstarted" },
    assignee: { id: "dev-2", name: "Developer Two" },
    labels: [{ id: "label-3", name: "Feature", color: "#00ff00" }],
  },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};
