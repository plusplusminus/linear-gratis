import { supabaseAdmin } from "./supabase";
import type { LinearIssue, RoadmapIssue } from "./linear";

/**
 * Check if a user has an active sync subscription (i.e. synced data available).
 */
export async function userHasSync(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("sync_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .single();

  return !!data;
}

// -- Shared helpers for reading from JSONB `data` column ────────────────────

type IssueData = {
  id?: string;
  identifier?: string;
  title?: string;
  description?: string;
  priority?: number;
  priorityLabel?: string;
  url?: string;
  dueDate?: string;
  state?: { id?: string; name?: string; color?: string; type?: string };
  assignee?: { id?: string; name?: string };
  labels?: Array<{ id: string; name: string; color: string }>;
  project?: { id?: string; name?: string; color?: string };
  createdAt?: string;
  updatedAt?: string;
};

type CommentData = {
  id?: string;
  body?: string;
  user?: { id?: string; name?: string };
  createdAt?: string;
  updatedAt?: string;
};

type TeamData = {
  id?: string;
  name?: string;
  displayName?: string;
  key?: string;
  description?: string;
  icon?: string;
  color?: string;
  private?: boolean;
  parent?: { id?: string; name?: string; key?: string };
  children?: Array<{ id: string }>;
  members?: Array<{ id: string; name: string }>;
  createdAt?: string;
  updatedAt?: string;
};

type ProjectData = {
  id?: string;
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  url?: string;
  priority?: number;
  priorityLabel?: string;
  progress?: number;
  health?: string;
  startDate?: string;
  targetDate?: string;
  status?: { id?: string; name?: string; color?: string; type?: string };
  lead?: { id?: string; name?: string };
  teams?: Array<{ id: string; name: string; key: string }>;
  initiatives?: Array<{ id: string; name: string }>;
  milestones?: Array<{ id: string; name: string; targetDate?: string }>;
  createdAt?: string;
  updatedAt?: string;
};

type InitiativeData = {
  id?: string;
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  url?: string;
  status?: string;
  health?: string;
  healthUpdatedAt?: string;
  targetDate?: string;
  owner?: { id?: string; name?: string };
  projects?: Array<{ id: string; name: string }>;
  subInitiatives?: Array<{ id: string; name: string }>;
  parentInitiative?: { id?: string; name?: string };
  createdAt?: string;
  updatedAt?: string;
};

/** Map a synced_issues row (with JSONB `data`) to the LinearIssue shape. */
export function mapRowToLinearIssue(row: {
  linear_id: string;
  data: IssueData;
  created_at: string;
  updated_at: string;
}): LinearIssue {
  const d = row.data;
  return {
    id: d.id ?? row.linear_id,
    identifier: d.identifier ?? "",
    title: d.title ?? "",
    description: d.description ?? undefined,
    priority: d.priority ?? 0,
    priorityLabel: d.priorityLabel ?? priorityToLabel(d.priority ?? 0),
    url: d.url ?? "",
    state: {
      id: d.state?.id ?? "",
      name: d.state?.name ?? "Unknown",
      color: d.state?.color ?? "",
      type: d.state?.type ?? "",
    },
    assignee: d.assignee
      ? { id: d.assignee.id ?? "", name: d.assignee.name ?? "" }
      : undefined,
    labels: Array.isArray(d.labels) ? d.labels : [],
    createdAt: d.createdAt ?? row.created_at,
    updatedAt: d.updatedAt ?? row.updated_at,
  };
}

/** Map a synced_issues row to RoadmapIssue shape (LinearIssue + dueDate + project). */
function mapRowToRoadmapIssue(row: {
  linear_id: string;
  data: IssueData;
  created_at: string;
  updated_at: string;
}): RoadmapIssue {
  const d = row.data;
  return {
    ...mapRowToLinearIssue(row),
    dueDate: d.dueDate ?? undefined,
    project: d.project
      ? { id: d.project.id ?? "", name: d.project.name ?? "", color: d.project.color }
      : undefined,
  };
}

/** Map a synced_comments row to the comment shape. */
export function mapRowToComment(row: {
  linear_id: string;
  data: CommentData;
  created_at: string;
  updated_at: string;
}) {
  const d = row.data;
  return {
    id: d.id ?? row.linear_id,
    body: d.body ?? "",
    createdAt: d.createdAt ?? row.created_at,
    updatedAt: d.updatedAt ?? row.updated_at,
    user: {
      id: d.user?.id ?? "",
      name: d.user?.name ?? "Unknown",
    },
  };
}

// -- Query functions ────────────────────────────────────────────────────────

/**
 * Fetch issues from synced_issues table, returning them in the same shape
 * as fetchLinearIssues so the response is identical to the frontend.
 */
export async function fetchSyncedIssues(
  userId: string,
  options: {
    projectId?: string;
    teamId?: string;
    statuses?: string[];
  }
): Promise<LinearIssue[]> {
  let query = supabaseAdmin
    .from("synced_issues")
    .select("linear_id, data, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (options.projectId) {
    query = query.eq("project_id", options.projectId);
  }
  if (options.teamId) {
    query = query.eq("team_id", options.teamId);
  }
  if (options.statuses && options.statuses.length > 0) {
    query = query.in("state_name", options.statuses);
  }

  const { data, error } = await query;

  if (error) {
    console.error("fetchSyncedIssues error:", error);
    throw error;
  }

  return (data || []).map((row) =>
    mapRowToLinearIssue(row as { linear_id: string; data: IssueData; created_at: string; updated_at: string })
  );
}

/**
 * Fetch comments for an issue from synced_comments.
 */
export async function fetchSyncedComments(
  userId: string,
  issueLinearId: string
) {
  const { data, error } = await supabaseAdmin
    .from("synced_comments")
    .select("linear_id, data, created_at, updated_at")
    .eq("user_id", userId)
    .eq("issue_linear_id", issueLinearId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("fetchSyncedComments error:", error);
    throw error;
  }

  return (data || []).map((row) =>
    mapRowToComment(row as { linear_id: string; data: CommentData; created_at: string; updated_at: string })
  );
}

/**
 * Derive metadata (unique states, labels, assignees) from synced issues.
 */
export async function fetchSyncedMetadata(
  userId: string,
  options: { projectId?: string; teamId?: string }
) {
  let query = supabaseAdmin
    .from("synced_issues")
    .select("data")
    .eq("user_id", userId);

  if (options.projectId) query = query.eq("project_id", options.projectId);
  if (options.teamId) query = query.eq("team_id", options.teamId);

  const { data, error } = await query;

  if (error || !data) return null;

  const statesMap = new Map<string, { id: string; name: string; color: string; type: string }>();
  const labelsMap = new Map<string, { id: string; name: string; color: string }>();
  const membersMap = new Map<string, { id: string; name: string }>();

  for (const row of data) {
    const d = row.data as IssueData;
    if (d.state?.name) {
      statesMap.set(d.state.name, {
        id: d.state.id ?? "",
        name: d.state.name,
        color: d.state.color ?? "",
        type: d.state.type ?? "",
      });
    }
    if (d.assignee?.name) {
      membersMap.set(d.assignee.name, {
        id: d.assignee.id ?? "",
        name: d.assignee.name,
      });
    }
    if (Array.isArray(d.labels)) {
      for (const label of d.labels) {
        labelsMap.set(label.id, label);
      }
    }
  }

  return {
    states: Array.from(statesMap.values()),
    labels: Array.from(labelsMap.values()),
    members: Array.from(membersMap.values()),
  };
}

/**
 * Fetch issues for a roadmap from synced_issues, supporting multiple project IDs.
 * Returns RoadmapIssue shape (includes dueDate and project).
 */
export async function fetchSyncedRoadmapIssues(
  userId: string,
  projectIds: string[]
): Promise<RoadmapIssue[]> {
  const { data, error } = await supabaseAdmin
    .from("synced_issues")
    .select("linear_id, data, created_at, updated_at")
    .eq("user_id", userId)
    .in("project_id", projectIds)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("fetchSyncedRoadmapIssues error:", error);
    throw error;
  }

  return (data || []).map((row) =>
    mapRowToRoadmapIssue(row as { linear_id: string; data: IssueData; created_at: string; updated_at: string })
  );
}

// -- Team mapping + queries ─────────────────────────────────────────────────

export function mapRowToTeam(row: {
  linear_id: string;
  data: TeamData;
  created_at: string;
  updated_at: string;
}) {
  const d = row.data;
  return {
    id: d.id ?? row.linear_id,
    name: d.name ?? "",
    displayName: d.displayName ?? d.name ?? "",
    key: d.key ?? "",
    description: d.description ?? undefined,
    icon: d.icon ?? undefined,
    color: d.color ?? undefined,
    private: d.private ?? false,
    parent: d.parent ?? undefined,
    children: Array.isArray(d.children) ? d.children : [],
    members: Array.isArray(d.members) ? d.members : [],
    createdAt: d.createdAt ?? row.created_at,
    updatedAt: d.updatedAt ?? row.updated_at,
  };
}

export async function fetchSyncedTeams(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("synced_teams")
    .select("linear_id, data, created_at, updated_at")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) {
    console.error("fetchSyncedTeams error:", error);
    throw error;
  }

  return (data || []).map((row) =>
    mapRowToTeam(row as { linear_id: string; data: TeamData; created_at: string; updated_at: string })
  );
}

export type SyncedTeamTree = ReturnType<typeof mapRowToTeam> & {
  childTeams: SyncedTeamTree[];
};

export async function fetchSyncedTeamHierarchy(userId: string): Promise<SyncedTeamTree[]> {
  const teams = await fetchSyncedTeams(userId);
  const teamMap = new Map<string, SyncedTeamTree>();

  // First pass: wrap all teams
  for (const team of teams) {
    teamMap.set(team.id, { ...team, childTeams: [] });
  }

  // Second pass: build tree
  const roots: SyncedTeamTree[] = [];
  for (const team of teamMap.values()) {
    if (team.parent?.id && teamMap.has(team.parent.id)) {
      teamMap.get(team.parent.id)!.childTeams.push(team);
    } else {
      roots.push(team);
    }
  }

  return roots;
}

// -- Project mapping + queries ──────────────────────────────────────────────

export function mapRowToProject(row: {
  linear_id: string;
  data: ProjectData;
  created_at: string;
  updated_at: string;
}) {
  const d = row.data;
  return {
    id: d.id ?? row.linear_id,
    name: d.name ?? "",
    description: d.description ?? undefined,
    icon: d.icon ?? undefined,
    color: d.color ?? undefined,
    url: d.url ?? "",
    priority: d.priority ?? 0,
    priorityLabel: d.priorityLabel ?? priorityToLabel(d.priority ?? 0),
    progress: d.progress ?? 0,
    health: d.health ?? undefined,
    startDate: d.startDate ?? undefined,
    targetDate: d.targetDate ?? undefined,
    status: d.status
      ? { id: d.status.id ?? "", name: d.status.name ?? "", color: d.status.color ?? "", type: d.status.type ?? "" }
      : { id: "", name: "Unknown", color: "", type: "" },
    lead: d.lead
      ? { id: d.lead.id ?? "", name: d.lead.name ?? "" }
      : undefined,
    teams: Array.isArray(d.teams) ? d.teams : [],
    initiatives: Array.isArray(d.initiatives) ? d.initiatives : [],
    milestones: Array.isArray(d.milestones) ? d.milestones : [],
    createdAt: d.createdAt ?? row.created_at,
    updatedAt: d.updatedAt ?? row.updated_at,
  };
}

export async function fetchSyncedProjects(
  userId: string,
  options?: { statusName?: string }
) {
  let query = supabaseAdmin
    .from("synced_projects")
    .select("linear_id, data, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (options?.statusName) {
    query = query.eq("status_name", options.statusName);
  }

  const { data, error } = await query;

  if (error) {
    console.error("fetchSyncedProjects error:", error);
    throw error;
  }

  return (data || []).map((row) =>
    mapRowToProject(row as { linear_id: string; data: ProjectData; created_at: string; updated_at: string })
  );
}

// -- Initiative mapping + queries ───────────────────────────────────────────

export function mapRowToInitiative(row: {
  linear_id: string;
  data: InitiativeData;
  created_at: string;
  updated_at: string;
}) {
  const d = row.data;
  return {
    id: d.id ?? row.linear_id,
    name: d.name ?? "",
    description: d.description ?? undefined,
    icon: d.icon ?? undefined,
    color: d.color ?? undefined,
    url: d.url ?? "",
    status: d.status ?? "Planned",
    health: d.health ?? undefined,
    healthUpdatedAt: d.healthUpdatedAt ?? undefined,
    targetDate: d.targetDate ?? undefined,
    owner: d.owner
      ? { id: d.owner.id ?? "", name: d.owner.name ?? "" }
      : undefined,
    projects: Array.isArray(d.projects) ? d.projects : [],
    subInitiatives: Array.isArray(d.subInitiatives) ? d.subInitiatives : [],
    parentInitiative: d.parentInitiative ?? undefined,
    createdAt: d.createdAt ?? row.created_at,
    updatedAt: d.updatedAt ?? row.updated_at,
  };
}

export async function fetchSyncedInitiatives(
  userId: string,
  options?: { status?: string }
) {
  let query = supabaseAdmin
    .from("synced_initiatives")
    .select("linear_id, data, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("fetchSyncedInitiatives error:", error);
    throw error;
  }

  return (data || []).map((row) =>
    mapRowToInitiative(row as { linear_id: string; data: InitiativeData; created_at: string; updated_at: string })
  );
}

// -- Utilities ──────────────────────────────────────────────────────────────

export function priorityToLabel(priority: number): string {
  switch (priority) {
    case 0: return "No priority";
    case 1: return "Urgent";
    case 2: return "High";
    case 3: return "Medium";
    case 4: return "Low";
    default: return "No priority";
  }
}
