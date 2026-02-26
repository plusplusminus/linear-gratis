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
