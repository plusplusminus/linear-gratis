import { supabaseAdmin, type HubTeamMapping, type HubMemberRole } from "./supabase";
import type { LinearIssue, RoadmapIssue } from "./linear";
import {
  mapRowToLinearIssue,
  mapRowToComment,
  mapRowToTeam,
  mapRowToProject,
  mapRowToInitiative,
} from "./sync-read";

const WORKSPACE_USER_ID = "workspace";

// -- Hub access ──────────────────────────────────────────────────────────────

export type HubAccess = {
  hubId: string;
  role: HubMemberRole;
};

/**
 * Verify the user is a member of the hub and return their role.
 * Returns null if not a member.
 */
export async function verifyHubAccess(
  hubId: string,
  userId: string
): Promise<HubAccess | null> {
  const { data } = await supabaseAdmin
    .from("hub_members")
    .select("role")
    .eq("hub_id", hubId)
    .eq("user_id", userId)
    .single();

  if (!data) return null;

  return { hubId, role: data.role as HubMemberRole };
}

// -- Internal helpers ────────────────────────────────────────────────────────

/**
 * Fetch active team mappings for a hub, including visibility arrays.
 */
async function getHubMappings(hubId: string): Promise<HubTeamMapping[]> {
  const { data, error } = await supabaseAdmin
    .from("hub_team_mappings")
    .select("*")
    .eq("hub_id", hubId)
    .eq("is_active", true);

  if (error) {
    console.error("getHubMappings error:", error);
    throw error;
  }

  return (data as HubTeamMapping[]) ?? [];
}

/**
 * Get allowed team IDs for a hub.
 */
async function getHubTeamIds(hubId: string): Promise<string[]> {
  const mappings = await getHubMappings(hubId);
  return mappings.map((m) => m.linear_team_id);
}

/**
 * Merge visibility arrays from all team mappings.
 * Empty array in any mapping = "all visible" for that team → return null (no filter).
 * Otherwise return the union of all IDs across mappings.
 */
function mergeVisibility(
  mappings: HubTeamMapping[],
  field: "visible_project_ids" | "visible_initiative_ids" | "visible_label_ids"
): string[] | null {
  let hasUnscoped = false;
  const ids = new Set<string>();

  for (const m of mappings) {
    const arr = m[field];
    if (!arr || arr.length === 0) {
      hasUnscoped = true;
    } else {
      for (const id of arr) ids.add(id);
    }
  }

  // If any mapping is unscoped, don't filter
  if (hasUnscoped) return null;
  return Array.from(ids);
}

/**
 * Strip assignee data from a LinearIssue (clients should not see assignees).
 */
function stripAssignee<T extends LinearIssue>(issue: T): T {
  return { ...issue, assignee: undefined };
}

/**
 * Filter labels on an issue to only those visible in the hub.
 */
function filterLabels<T extends LinearIssue>(
  issue: T,
  allowedLabelIds: string[] | null
): T {
  if (!allowedLabelIds) return issue;
  return {
    ...issue,
    labels: issue.labels.filter((l) => allowedLabelIds.includes(l.id)),
  };
}

// -- Hub-scoped query functions ──────────────────────────────────────────────

/**
 * Fetch issues scoped to a hub's teams, with visibility filtering.
 * Strips assignees. Filters labels.
 */
export async function fetchHubIssues(
  hubId: string,
  options?: {
    projectId?: string;
    teamId?: string;
    statuses?: string[];
  }
): Promise<LinearIssue[]> {
  const mappings = await getHubMappings(hubId);
  if (mappings.length === 0) return [];

  const teamIds = mappings.map((m) => m.linear_team_id);
  const allowedProjectIds = mergeVisibility(mappings, "visible_project_ids");
  const allowedLabelIds = mergeVisibility(mappings, "visible_label_ids");

  // If a specific teamId is requested, verify it belongs to this hub
  if (options?.teamId && !teamIds.includes(options.teamId)) {
    return [];
  }

  // If a specific projectId is requested, verify it's visible
  if (options?.projectId && allowedProjectIds && !allowedProjectIds.includes(options.projectId)) {
    return [];
  }

  let query = supabaseAdmin
    .from("synced_issues")
    .select("linear_id, data, created_at, updated_at")
    .eq("user_id", WORKSPACE_USER_ID)
    .in("team_id", options?.teamId ? [options.teamId] : teamIds)
    .order("updated_at", { ascending: false });

  if (options?.projectId) {
    query = query.eq("project_id", options.projectId);
  } else if (allowedProjectIds) {
    query = query.in("project_id", allowedProjectIds);
  }

  if (options?.statuses && options.statuses.length > 0) {
    query = query.in("state_name", options.statuses);
  }

  const { data, error } = await query;

  if (error) {
    console.error("fetchHubIssues error:", error);
    throw error;
  }

  return (data || []).map((row) => {
    const issue = mapRowToLinearIssue(
      row as { linear_id: string; data: Record<string, unknown>; created_at: string; updated_at: string }
    );
    return filterLabels(stripAssignee(issue), allowedLabelIds);
  });
}

/**
 * Fetch a single issue by Linear ID, scoped to a hub.
 * Returns the issue with description, dueDate, and hub-visible labels, or null.
 */
export async function fetchHubIssueDetail(
  hubId: string,
  issueLinearId: string
) {
  const mappings = await getHubMappings(hubId);
  if (mappings.length === 0) return null;

  const teamIds = mappings.map((m) => m.linear_team_id);
  const allowedLabelIds = mergeVisibility(mappings, "visible_label_ids");

  const { data: row } = await supabaseAdmin
    .from("synced_issues")
    .select("linear_id, data, created_at, updated_at, team_id")
    .eq("user_id", WORKSPACE_USER_ID)
    .eq("linear_id", issueLinearId)
    .single();

  if (!row || !teamIds.includes(row.team_id)) return null;

  const issue = mapRowToLinearIssue(
    row as { linear_id: string; data: Record<string, unknown>; created_at: string; updated_at: string }
  );
  const d = row.data as Record<string, unknown>;

  return filterLabels(stripAssignee({
    ...issue,
    dueDate: (d.dueDate as string) ?? undefined,
  }), allowedLabelIds);
}

/**
 * Fetch roadmap issues scoped to a hub, supporting multiple project IDs.
 */
export async function fetchHubRoadmapIssues(
  hubId: string,
  projectIds: string[]
): Promise<RoadmapIssue[]> {
  const mappings = await getHubMappings(hubId);
  if (mappings.length === 0) return [];

  const allowedProjectIds = mergeVisibility(mappings, "visible_project_ids");
  const allowedLabelIds = mergeVisibility(mappings, "visible_label_ids");

  // Filter requested projectIds to only those visible in the hub
  const filteredProjectIds = allowedProjectIds
    ? projectIds.filter((id) => allowedProjectIds.includes(id))
    : projectIds;

  if (filteredProjectIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("synced_issues")
    .select("linear_id, data, created_at, updated_at")
    .eq("user_id", WORKSPACE_USER_ID)
    .in("project_id", filteredProjectIds)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("fetchHubRoadmapIssues error:", error);
    throw error;
  }

  return (data || []).map((row) => {
    const d = row.data as Record<string, unknown>;
    const issue = mapRowToLinearIssue(
      row as { linear_id: string; data: Record<string, unknown>; created_at: string; updated_at: string }
    );
    return filterLabels(stripAssignee({
      ...issue,
      dueDate: (d.dueDate as string) ?? undefined,
      project: d.project
        ? {
            id: (d.project as Record<string, unknown>).id as string ?? "",
            name: (d.project as Record<string, unknown>).name as string ?? "",
            color: (d.project as Record<string, unknown>).color as string | undefined,
          }
        : undefined,
    }), allowedLabelIds);
  });
}

/**
 * Fetch comments for an issue, verifying the issue belongs to the hub's scope.
 * Merges synced Linear comments with hub_comments (client-authored).
 */
export async function fetchHubComments(
  hubId: string,
  issueLinearId: string
) {
  // Verify the issue belongs to this hub's teams
  const teamIds = await getHubTeamIds(hubId);
  if (teamIds.length === 0) return [];

  const { data: issueRow } = await supabaseAdmin
    .from("synced_issues")
    .select("team_id")
    .eq("user_id", WORKSPACE_USER_ID)
    .eq("linear_id", issueLinearId)
    .single();

  if (!issueRow || !teamIds.includes(issueRow.team_id)) {
    return [];
  }

  // Fetch both Linear synced comments and hub comments in parallel
  const [linearResult, hubResult] = await Promise.all([
    supabaseAdmin
      .from("synced_comments")
      .select("linear_id, data, created_at, updated_at")
      .eq("user_id", WORKSPACE_USER_ID)
      .eq("issue_linear_id", issueLinearId)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("hub_comments")
      .select("id, author_name, author_email, body, push_status, push_error, created_at, updated_at")
      .eq("hub_id", hubId)
      .eq("issue_linear_id", issueLinearId)
      .order("created_at", { ascending: true }),
  ]);

  const linearComments = (linearResult.data || []).map((row) =>
    mapRowToComment(
      row as { linear_id: string; data: Record<string, unknown>; created_at: string; updated_at: string }
    )
  );

  const hubComments = (hubResult.data || []).map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    push_status: row.push_status as string | undefined,
    push_error: row.push_error as string | undefined,
    user: {
      id: "",
      name: row.author_name,
    },
    isHubComment: true,
  }));

  // Merge and sort by createdAt
  const all = [...linearComments, ...hubComments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return all;
}

/**
 * Fetch teams mapped to a hub.
 */
export async function fetchHubTeams(hubId: string) {
  const teamIds = await getHubTeamIds(hubId);
  if (teamIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("synced_teams")
    .select("linear_id, data, created_at, updated_at")
    .eq("user_id", WORKSPACE_USER_ID)
    .in("linear_id", teamIds)
    .order("name", { ascending: true });

  if (error) {
    console.error("fetchHubTeams error:", error);
    throw error;
  }

  return (data || []).map((row) =>
    mapRowToTeam(
      row as { linear_id: string; data: Record<string, unknown>; created_at: string; updated_at: string }
    )
  );
}

/**
 * Fetch per-team stats for a hub's landing page.
 * Returns project count, open issue count, and last activity per team.
 */
export async function fetchHubTeamStats(hubId: string) {
  const mappings = await getHubMappings(hubId);
  if (mappings.length === 0) return new Map<string, { projectCount: number; openIssueCount: number; lastActivity: string | null }>();

  const teamIds = mappings.map((m) => m.linear_team_id);

  // Fetch open issue counts and latest updated_at per team
  // "Open" = not in completed/cancelled state types
  const { data: issues } = await supabaseAdmin
    .from("synced_issues")
    .select("team_id, data, updated_at")
    .eq("user_id", WORKSPACE_USER_ID)
    .in("team_id", teamIds);

  // Fetch projects and count per team
  const { data: projects } = await supabaseAdmin
    .from("synced_projects")
    .select("linear_id, data")
    .eq("user_id", WORKSPACE_USER_ID);

  const stats = new Map<string, { projectCount: number; openIssueCount: number; lastActivity: string | null }>();

  for (const teamId of teamIds) {
    stats.set(teamId, { projectCount: 0, openIssueCount: 0, lastActivity: null });
  }

  // Count open issues and track latest activity per team
  const completedTypes = new Set(["completed", "cancelled"]);
  for (const issue of issues || []) {
    const teamStat = stats.get(issue.team_id);
    if (!teamStat) continue;

    const d = issue.data as Record<string, unknown>;
    const stateType = (d.state as Record<string, unknown> | undefined)?.type as string | undefined;
    if (!stateType || !completedTypes.has(stateType)) {
      teamStat.openIssueCount++;
    }

    if (!teamStat.lastActivity || issue.updated_at > teamStat.lastActivity) {
      teamStat.lastActivity = issue.updated_at;
    }
  }

  // Count projects per team (projects have teams array in data)
  const allowedProjectIds = mergeVisibility(mappings, "visible_project_ids");
  for (const proj of projects || []) {
    if (allowedProjectIds && !allowedProjectIds.includes(proj.linear_id)) continue;
    const d = proj.data as Record<string, unknown>;
    const projTeams = d.teams as Array<{ id: string }> | undefined;
    if (Array.isArray(projTeams)) {
      for (const pt of projTeams) {
        const teamStat = stats.get(pt.id);
        if (teamStat) teamStat.projectCount++;
      }
    }
  }

  return stats;
}

/**
 * Fetch projects visible to a hub.
 * Filters by allowed project IDs from hub_team_mappings visibility config.
 */
export async function fetchHubProjects(
  hubId: string,
  options?: { statusName?: string }
) {
  const mappings = await getHubMappings(hubId);
  if (mappings.length === 0) return [];

  const teamIds = mappings.map((m) => m.linear_team_id);
  const allowedProjectIds = mergeVisibility(mappings, "visible_project_ids");

  // Projects are linked to teams — fetch all, then filter
  let query = supabaseAdmin
    .from("synced_projects")
    .select("linear_id, data, created_at, updated_at")
    .eq("user_id", WORKSPACE_USER_ID)
    .order("updated_at", { ascending: false });

  if (options?.statusName) {
    query = query.eq("status_name", options.statusName);
  }

  if (allowedProjectIds) {
    query = query.in("linear_id", allowedProjectIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error("fetchHubProjects error:", error);
    throw error;
  }

  // Post-filter: only projects that belong to at least one hub team
  return (data || [])
    .map((row) =>
      mapRowToProject(
        row as { linear_id: string; data: Record<string, unknown>; created_at: string; updated_at: string }
      )
    )
    .filter((project) => {
      // If we already filtered by allowedProjectIds, all are visible
      if (allowedProjectIds) return true;
      // Otherwise ensure the project has at least one team in the hub
      return project.teams.some((t) => teamIds.includes(t.id));
    });
}

/**
 * Fetch initiatives visible to a hub.
 * Filters by allowed initiative IDs from hub_team_mappings visibility config.
 */
export async function fetchHubInitiatives(
  hubId: string,
  options?: { status?: string }
) {
  const mappings = await getHubMappings(hubId);
  if (mappings.length === 0) return [];

  const allowedInitiativeIds = mergeVisibility(mappings, "visible_initiative_ids");

  let query = supabaseAdmin
    .from("synced_initiatives")
    .select("linear_id, data, created_at, updated_at")
    .eq("user_id", WORKSPACE_USER_ID)
    .order("updated_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (allowedInitiativeIds) {
    query = query.in("linear_id", allowedInitiativeIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error("fetchHubInitiatives error:", error);
    throw error;
  }

  return (data || []).map((row) =>
    mapRowToInitiative(
      row as { linear_id: string; data: Record<string, unknown>; created_at: string; updated_at: string }
    )
  );
}

/**
 * Get the set of hub-visible label IDs.
 * Returns null if unscoped (all labels visible).
 */
export async function getHubVisibleLabelIds(
  hubId: string
): Promise<string[] | null> {
  const mappings = await getHubMappings(hubId);
  return mergeVisibility(mappings, "visible_label_ids");
}

/**
 * Derive metadata (states, labels) from hub-scoped issues.
 * Strips assignees — returns states and visible labels only.
 */
export async function fetchHubMetadata(
  hubId: string,
  options?: { projectId?: string; teamId?: string }
) {
  const mappings = await getHubMappings(hubId);
  if (mappings.length === 0) return { states: [], labels: [] };

  const teamIds = mappings.map((m) => m.linear_team_id);
  const allowedLabelIds = mergeVisibility(mappings, "visible_label_ids");

  // If a specific teamId is requested, verify it belongs to this hub
  if (options?.teamId && !teamIds.includes(options.teamId)) {
    return { states: [], labels: [] };
  }

  let query = supabaseAdmin
    .from("synced_issues")
    .select("data")
    .eq("user_id", WORKSPACE_USER_ID)
    .in("team_id", options?.teamId ? [options.teamId] : teamIds);

  if (options?.projectId) query = query.eq("project_id", options.projectId);

  const { data, error } = await query;
  if (error || !data) return { states: [], labels: [] };

  const statesMap = new Map<string, { id: string; name: string; color: string; type: string }>();
  const labelsMap = new Map<string, { id: string; name: string; color: string }>();

  for (const row of data) {
    const d = row.data as Record<string, unknown>;
    const state = d.state as { id?: string; name?: string; color?: string; type?: string } | undefined;
    if (state?.name) {
      statesMap.set(state.name, {
        id: state.id ?? "",
        name: state.name,
        color: state.color ?? "",
        type: state.type ?? "",
      });
    }
    const labels = d.labels as Array<{ id: string; name: string; color: string }> | undefined;
    if (Array.isArray(labels)) {
      for (const label of labels) {
        if (allowedLabelIds && !allowedLabelIds.includes(label.id)) continue;
        labelsMap.set(label.id, label);
      }
    }
    // No assignees — intentionally omitted for client hub view
  }

  return {
    states: Array.from(statesMap.values()),
    labels: Array.from(labelsMap.values()),
  };
}
