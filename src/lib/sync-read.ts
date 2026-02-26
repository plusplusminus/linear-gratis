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
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (options.projectId) {
    query = query.eq("project_id", options.projectId);
  }
  if (options.teamId) {
    query = query.eq("team_id", options.teamId);
  }
  if (options.statuses && options.statuses.length > 0) {
    query = query.in("state", options.statuses);
  }

  const { data, error } = await query;

  if (error) {
    console.error("fetchSyncedIssues error:", error);
    throw error;
  }

  // Map to the LinearIssue shape expected by the frontend
  return (data || []).map((row) => ({
    id: row.linear_id,
    identifier: row.identifier,
    title: row.title,
    description: row.description ?? undefined,
    priority: row.priority ?? 0,
    priorityLabel: priorityToLabel(row.priority ?? 0),
    url: row.url ?? "",
    state: {
      id: "",
      name: row.state ?? "Unknown",
      color: "",
      type: "",
    },
    assignee: row.assignee
      ? { id: "", name: row.assignee }
      : undefined,
    labels: Array.isArray(row.labels) ? row.labels as Array<{ id: string; name: string; color: string }> : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
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
    .select("*")
    .eq("user_id", userId)
    .eq("issue_linear_id", issueLinearId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("fetchSyncedComments error:", error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.linear_id,
    body: row.body ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: {
      id: "",
      name: row.author_name ?? "Unknown",
    },
  }));
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
    .select("state, labels, assignee")
    .eq("user_id", userId);

  if (options.projectId) query = query.eq("project_id", options.projectId);
  if (options.teamId) query = query.eq("team_id", options.teamId);

  const { data, error } = await query;

  if (error || !data) return null;

  const states = new Set<string>();
  const labelsMap = new Map<string, { id: string; name: string; color: string }>();
  const members = new Set<string>();

  for (const row of data) {
    if (row.state) states.add(row.state);
    if (row.assignee) members.add(row.assignee);
    if (Array.isArray(row.labels)) {
      for (const label of row.labels as Array<{ id: string; name: string; color: string }>) {
        labelsMap.set(label.id, label);
      }
    }
  }

  return {
    states: Array.from(states).map((name) => ({ id: "", name, color: "", type: "" })),
    labels: Array.from(labelsMap.values()),
    members: Array.from(members).map((name) => ({ id: "", name })),
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
    .select("*")
    .eq("user_id", userId)
    .in("project_id", projectIds)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("fetchSyncedRoadmapIssues error:", error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.linear_id,
    identifier: row.identifier,
    title: row.title,
    description: row.description ?? undefined,
    priority: row.priority ?? 0,
    priorityLabel: priorityToLabel(row.priority ?? 0),
    url: row.url ?? "",
    dueDate: row.due_date ?? undefined,
    state: {
      id: "",
      name: row.state ?? "Unknown",
      color: "",
      type: "",
    },
    assignee: row.assignee ? { id: "", name: row.assignee } : undefined,
    labels: Array.isArray(row.labels)
      ? (row.labels as Array<{ id: string; name: string; color: string }>)
      : [],
    project: row.project_id
      ? { id: row.project_id, name: "", color: undefined }
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function priorityToLabel(priority: number): string {
  switch (priority) {
    case 0: return "No priority";
    case 1: return "Urgent";
    case 2: return "High";
    case 3: return "Medium";
    case 4: return "Low";
    default: return "No priority";
  }
}
