import { supabaseAdmin } from "./supabase";

const LINEAR_API = "https://api.linear.app/graphql";
const PAGE_SIZE = 50;

// -- GraphQL queries ---------------------------------------------------------

const ISSUES_QUERY = `
  query TeamIssues($teamId: String!, $after: String) {
    issues(
      filter: { team: { id: { eq: $teamId } } }
      first: ${PAGE_SIZE}
      after: $after
      orderBy: updatedAt
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        identifier
        title
        description
        priority
        url
        dueDate
        state { name }
        assignee { name }
        labels { nodes { id name color } }
        team { id }
        project { id }
        createdAt
        updatedAt
      }
    }
  }
`;

const COMMENTS_QUERY = `
  query IssueComments($issueId: String!, $after: String) {
    comments(
      filter: { issue: { id: { eq: $issueId } } }
      first: ${PAGE_SIZE}
      after: $after
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        body
        user { name }
        createdAt
        updatedAt
      }
    }
  }
`;

// -- Types -------------------------------------------------------------------

type LinearGqlIssue = {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  url: string;
  dueDate?: string;
  state?: { name: string };
  assignee?: { name: string };
  labels: { nodes: Array<{ id: string; name: string; color: string }> };
  team?: { id: string };
  project?: { id: string };
  createdAt: string;
  updatedAt: string;
};

type LinearGqlComment = {
  id: string;
  body?: string;
  user?: { name: string };
  createdAt: string;
  updatedAt: string;
};

type PageInfo = {
  hasNextPage: boolean;
  endCursor: string | null;
};

// -- Helpers -----------------------------------------------------------------

async function linearRequest<T>(
  apiToken: string,
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiToken.trim(),
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Linear API ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };

  if (json.errors) {
    throw new Error(`GraphQL: ${json.errors.map((e) => e.message).join(", ")}`);
  }

  if (!json.data) {
    throw new Error("No data returned from Linear API");
  }

  return json.data;
}

// -- Core sync logic ---------------------------------------------------------

async function fetchAllIssues(
  apiToken: string,
  teamId: string
): Promise<LinearGqlIssue[]> {
  const allIssues: LinearGqlIssue[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const data = await linearRequest<{
      issues: { pageInfo: PageInfo; nodes: LinearGqlIssue[] };
    }>(apiToken, ISSUES_QUERY, { teamId, after: cursor });

    allIssues.push(...data.issues.nodes);
    hasMore = data.issues.pageInfo.hasNextPage;
    cursor = data.issues.pageInfo.endCursor ?? undefined;
  }

  return allIssues;
}

async function fetchCommentsForIssue(
  apiToken: string,
  issueId: string
): Promise<LinearGqlComment[]> {
  const allComments: LinearGqlComment[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const data = await linearRequest<{
      comments: { pageInfo: PageInfo; nodes: LinearGqlComment[] };
    }>(apiToken, COMMENTS_QUERY, { issueId, after: cursor });

    allComments.push(...data.comments.nodes);
    hasMore = data.comments.pageInfo.hasNextPage;
    cursor = data.comments.pageInfo.endCursor ?? undefined;
  }

  return allComments;
}

// -- Upsert batching ---------------------------------------------------------

function mapIssueToRow(issue: LinearGqlIssue, userId: string) {
  return {
    linear_id: issue.id,
    user_id: userId,
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description ?? null,
    state: issue.state?.name ?? null,
    priority: issue.priority,
    assignee: issue.assignee?.name ?? null,
    labels: issue.labels.nodes,
    due_date: issue.dueDate ?? null,
    url: issue.url,
    team_id: issue.team?.id ?? null,
    project_id: issue.project?.id ?? null,
    created_at: issue.createdAt,
    updated_at: issue.updatedAt,
    synced_at: new Date().toISOString(),
  };
}

function mapCommentToRow(
  comment: LinearGqlComment,
  issueLinearId: string,
  userId: string
) {
  return {
    linear_id: comment.id,
    issue_linear_id: issueLinearId,
    user_id: userId,
    body: comment.body ?? null,
    author_name: comment.user?.name ?? null,
    created_at: comment.createdAt,
    updated_at: comment.updatedAt,
    synced_at: new Date().toISOString(),
  };
}

// -- Public API --------------------------------------------------------------

export type SyncResult = {
  success: boolean;
  issueCount: number;
  commentCount: number;
  error?: string;
};

/**
 * Run initial sync: fetch all issues and comments for a team from Linear
 * and upsert them into Supabase. Idempotent via unique constraints.
 */
export async function runInitialSync(
  apiToken: string,
  userId: string,
  teamId: string
): Promise<SyncResult> {
  try {
    // 1. Fetch all issues
    const issues = await fetchAllIssues(apiToken, teamId);

    // 2. Upsert issues in batches of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < issues.length; i += BATCH_SIZE) {
      const batch = issues.slice(i, i + BATCH_SIZE);
      const rows = batch.map((issue) => mapIssueToRow(issue, userId));

      const { error } = await supabaseAdmin
        .from("synced_issues")
        .upsert(rows, { onConflict: "user_id,linear_id" });

      if (error) {
        console.error("Issue upsert batch error:", error);
        throw error;
      }
    }

    // 3. Fetch and upsert comments for each issue
    let totalComments = 0;

    for (const issue of issues) {
      const comments = await fetchCommentsForIssue(apiToken, issue.id);

      if (comments.length > 0) {
        const rows = comments.map((c) =>
          mapCommentToRow(c, issue.id, userId)
        );

        const { error } = await supabaseAdmin
          .from("synced_comments")
          .upsert(rows, { onConflict: "user_id,linear_id" });

        if (error) {
          console.error("Comment upsert error:", error);
          // Continue with other issues — don't fail the whole sync
        } else {
          totalComments += comments.length;
        }
      }
    }

    return {
      success: true,
      issueCount: issues.length,
      commentCount: totalComments,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown sync error";
    console.error("Initial sync failed:", message);
    return {
      success: false,
      issueCount: 0,
      commentCount: 0,
      error: message,
    };
  }
}
