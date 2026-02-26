import crypto from "crypto";
import { supabaseAdmin } from "./supabase";

// -- Signature verification --------------------------------------------------

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const expected = hmac.digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// -- Subscription lookup -----------------------------------------------------

export async function lookupSubscriptionByWebhookId(webhookId: string) {
  const { data, error } = await supabaseAdmin
    .from("sync_subscriptions")
    .select("*")
    .eq("webhook_id", webhookId)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;
  return data as {
    id: string;
    user_id: string;
    linear_team_id: string;
    webhook_id: string;
    webhook_secret: string;
    events: string[];
    is_active: boolean;
  };
}

// -- Linear webhook payload types --------------------------------------------

type LinearWebhookPayload = {
  action: "create" | "update" | "remove";
  type: string;
  data: Record<string, unknown>;
  url?: string;
  createdAt: string;
  webhookId?: string;
  webhookTimestamp?: number;
};

type LinearIssueData = {
  id: string;
  identifier?: string;
  title?: string;
  description?: string;
  state?: { name?: string };
  priority?: number;
  assignee?: { name?: string };
  labels?: Array<{ id: string; name: string; color: string }>;
  dueDate?: string;
  url?: string;
  team?: { id: string };
  project?: { id: string };
  createdAt?: string;
  updatedAt?: string;
};

type LinearCommentData = {
  id: string;
  body?: string;
  issue?: { id: string };
  user?: { name?: string };
  createdAt?: string;
  updatedAt?: string;
};

// -- Issue event handler -----------------------------------------------------

export async function handleIssueEvent(
  action: string,
  data: Record<string, unknown>,
  userId: string
): Promise<void> {
  const issue = data as unknown as LinearIssueData;

  if (action === "remove") {
    await supabaseAdmin
      .from("synced_issues")
      .delete()
      .eq("user_id", userId)
      .eq("linear_id", issue.id);
    return;
  }

  // Build the upsert row — only include fields that are present
  const row: Record<string, unknown> = {
    linear_id: issue.id,
    user_id: userId,
    synced_at: new Date().toISOString(),
  };

  if (issue.identifier !== undefined) row.identifier = issue.identifier;
  if (issue.title !== undefined) row.title = issue.title;
  if (issue.description !== undefined) row.description = issue.description;
  if (issue.state?.name !== undefined) row.state = issue.state.name;
  if (issue.priority !== undefined) row.priority = issue.priority;
  if (issue.assignee?.name !== undefined) row.assignee = issue.assignee.name;
  if (issue.labels !== undefined) row.labels = issue.labels;
  if (issue.dueDate !== undefined) row.due_date = issue.dueDate;
  if (issue.url !== undefined) row.url = issue.url;
  if (issue.team?.id !== undefined) row.team_id = issue.team.id;
  if (issue.project?.id !== undefined) row.project_id = issue.project.id;

  if (action === "create") {
    row.created_at = issue.createdAt || new Date().toISOString();
    row.updated_at = issue.updatedAt || new Date().toISOString();
  } else {
    row.updated_at = issue.updatedAt || new Date().toISOString();
  }

  const { error } = await supabaseAdmin.from("synced_issues").upsert(row, {
    onConflict: "user_id,linear_id",
  });

  if (error) {
    console.error("Failed to upsert synced_issue:", error);
    throw error;
  }
}

// -- Comment event handler ---------------------------------------------------

export async function handleCommentEvent(
  action: string,
  data: Record<string, unknown>,
  userId: string
): Promise<void> {
  const comment = data as unknown as LinearCommentData;

  if (action === "remove") {
    await supabaseAdmin
      .from("synced_comments")
      .delete()
      .eq("user_id", userId)
      .eq("linear_id", comment.id);
    return;
  }

  const row: Record<string, unknown> = {
    linear_id: comment.id,
    user_id: userId,
    synced_at: new Date().toISOString(),
  };

  if (comment.body !== undefined) row.body = comment.body;
  if (comment.issue?.id !== undefined) row.issue_linear_id = comment.issue.id;
  if (comment.user?.name !== undefined) row.author_name = comment.user.name;

  if (action === "create") {
    row.created_at = comment.createdAt || new Date().toISOString();
    row.updated_at = comment.updatedAt || new Date().toISOString();
  } else {
    row.updated_at = comment.updatedAt || new Date().toISOString();
  }

  const { error } = await supabaseAdmin.from("synced_comments").upsert(row, {
    onConflict: "user_id,linear_id",
  });

  if (error) {
    console.error("Failed to upsert synced_comment:", error);
    throw error;
  }
}

// -- Main event router -------------------------------------------------------

export async function routeWebhookEvent(
  payload: LinearWebhookPayload,
  userId: string
): Promise<void> {
  const { action, type, data } = payload;

  switch (type) {
    case "Issue":
      await handleIssueEvent(action, data, userId);
      break;
    case "Comment":
      await handleCommentEvent(action, data, userId);
      break;
    default:
      console.log(`Ignoring unhandled webhook event type: ${type}`);
  }
}
