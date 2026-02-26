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
        priorityLabel
        url
        dueDate
        state { id name color type }
        assignee { id name }
        labels { nodes { id name color } }
        team { id name key }
        project { id name }
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
        user { id name }
        issue { id }
        createdAt
        updatedAt
      }
    }
  }
`;

const TEAMS_QUERY = `
  query ViewerTeams($after: String) {
    teams(
      first: ${PAGE_SIZE}
      after: $after
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        displayName
        key
        description
        icon
        color
        private
        parent { id name key }
        children { nodes { id } }
        members { nodes { id name } }
        createdAt
        updatedAt
      }
    }
  }
`;

const PROJECTS_QUERY = `
  query TeamProjects($teamId: String!, $after: String) {
    projects(
      filter: { accessibleTeams: { id: { eq: $teamId } } }
      first: ${PAGE_SIZE}
      after: $after
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        description
        icon
        color
        url
        priority
        priorityLabel
        progress
        health
        startDate
        targetDate
        status { id name color type }
        lead { id name }
        teams { nodes { id name key } }
        initiatives { nodes { id name } }
        projectMilestones { nodes { id name targetDate } }
        createdAt
        updatedAt
      }
    }
  }
`;

const INITIATIVES_QUERY = `
  query ViewerInitiatives($after: String) {
    initiatives(
      first: ${PAGE_SIZE}
      after: $after
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        description
        icon
        color
        url
        status
        health
        healthUpdatedAt
        targetDate
        owner { id name }
        projects { nodes { id name } }
        subInitiatives { nodes { id name } }
        parentInitiative { id name }
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
  priorityLabel?: string;
  url: string;
  dueDate?: string;
  state?: { id: string; name: string; color: string; type: string };
  assignee?: { id: string; name: string };
  labels: { nodes: Array<{ id: string; name: string; color: string }> };
  team?: { id: string; name: string; key: string };
  project?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
};

type LinearGqlComment = {
  id: string;
  body?: string;
  user?: { id: string; name: string };
  issue?: { id: string };
  createdAt: string;
  updatedAt: string;
};

type LinearGqlTeam = {
  id: string;
  name: string;
  displayName?: string;
  key: string;
  description?: string;
  icon?: string;
  color?: string;
  private?: boolean;
  parent?: { id: string; name: string; key: string };
  children: { nodes: Array<{ id: string }> };
  members: { nodes: Array<{ id: string; name: string }> };
  createdAt: string;
  updatedAt: string;
};

type LinearGqlProject = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  url?: string;
  priority: number;
  priorityLabel?: string;
  progress?: number;
  health?: string;
  startDate?: string;
  targetDate?: string;
  status?: { id: string; name: string; color: string; type: string };
  lead?: { id: string; name: string };
  teams: { nodes: Array<{ id: string; name: string; key: string }> };
  initiatives: { nodes: Array<{ id: string; name: string }> };
  projectMilestones: { nodes: Array<{ id: string; name: string; targetDate?: string }> };
  createdAt: string;
  updatedAt: string;
};

type LinearGqlInitiative = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  url?: string;
  status?: string;
  health?: string;
  healthUpdatedAt?: string;
  targetDate?: string;
  owner?: { id: string; name: string };
  projects: { nodes: Array<{ id: string; name: string }> };
  subInitiatives: { nodes: Array<{ id: string; name: string }> };
  parentInitiative?: { id: string; name: string };
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

export async function fetchAllIssues(
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

export async function fetchAllTeams(
  apiToken: string
): Promise<LinearGqlTeam[]> {
  const all: LinearGqlTeam[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const data = await linearRequest<{
      teams: { pageInfo: PageInfo; nodes: LinearGqlTeam[] };
    }>(apiToken, TEAMS_QUERY, { after: cursor });

    all.push(...data.teams.nodes);
    hasMore = data.teams.pageInfo.hasNextPage;
    cursor = data.teams.pageInfo.endCursor ?? undefined;
  }

  return all;
}

export async function fetchAllProjects(
  apiToken: string,
  teamId: string
): Promise<LinearGqlProject[]> {
  const all: LinearGqlProject[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const data = await linearRequest<{
      projects: { pageInfo: PageInfo; nodes: LinearGqlProject[] };
    }>(apiToken, PROJECTS_QUERY, { teamId, after: cursor });

    all.push(...data.projects.nodes);
    hasMore = data.projects.pageInfo.hasNextPage;
    cursor = data.projects.pageInfo.endCursor ?? undefined;
  }

  return all;
}

export async function fetchAllInitiatives(
  apiToken: string
): Promise<LinearGqlInitiative[]> {
  const all: LinearGqlInitiative[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const data = await linearRequest<{
      initiatives: { pageInfo: PageInfo; nodes: LinearGqlInitiative[] };
    }>(apiToken, INITIATIVES_QUERY, { after: cursor });

    all.push(...data.initiatives.nodes);
    hasMore = data.initiatives.pageInfo.hasNextPage;
    cursor = data.initiatives.pageInfo.endCursor ?? undefined;
  }

  return all;
}

// -- Upsert batching ---------------------------------------------------------

export function mapIssueToRow(issue: LinearGqlIssue, userId: string) {
  // Normalize labels from GraphQL { nodes: [...] } to flat array for the data blob
  const data = {
    ...issue,
    labels: issue.labels.nodes,
  };

  return {
    linear_id: issue.id,
    user_id: userId,
    identifier: issue.identifier,
    // Indexed columns for filtering/sorting
    state_name: issue.state?.name ?? null,
    priority: issue.priority,
    assignee_name: issue.assignee?.name ?? null,
    team_id: issue.team?.id ?? null,
    project_id: issue.project?.id ?? null,
    created_at: issue.createdAt,
    updated_at: issue.updatedAt,
    synced_at: new Date().toISOString(),
    data, // Full payload for reads
  };
}

function mapCommentToRow(
  comment: LinearGqlComment,
  issueLinearId: string,
  userId: string
) {
  return {
    linear_id: comment.id,
    user_id: userId,
    issue_linear_id: issueLinearId,
    created_at: comment.createdAt,
    updated_at: comment.updatedAt,
    synced_at: new Date().toISOString(),
    data: comment, // Full payload for reads
  };
}

export function mapTeamToRow(team: LinearGqlTeam, userId: string) {
  const data = {
    ...team,
    children: team.children.nodes,
    members: team.members.nodes,
  };

  return {
    linear_id: team.id,
    user_id: userId,
    name: team.name,
    key: team.key,
    parent_team_id: team.parent?.id ?? null,
    created_at: team.createdAt,
    updated_at: team.updatedAt,
    synced_at: new Date().toISOString(),
    data,
  };
}

export function mapProjectToRow(project: LinearGqlProject, userId: string) {
  const data = {
    ...project,
    teams: project.teams.nodes,
    initiatives: project.initiatives.nodes,
    milestones: project.projectMilestones.nodes,
  };

  return {
    linear_id: project.id,
    user_id: userId,
    name: project.name,
    status_name: project.status?.name ?? null,
    lead_name: project.lead?.name ?? null,
    priority: project.priority,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
    synced_at: new Date().toISOString(),
    data,
  };
}

export function mapInitiativeToRow(initiative: LinearGqlInitiative, userId: string) {
  const data = {
    ...initiative,
    projects: initiative.projects.nodes,
    subInitiatives: initiative.subInitiatives.nodes,
  };

  return {
    linear_id: initiative.id,
    user_id: userId,
    name: initiative.name,
    status: initiative.status ?? null,
    owner_name: initiative.owner?.name ?? null,
    created_at: initiative.createdAt,
    updated_at: initiative.updatedAt,
    synced_at: new Date().toISOString(),
    data,
  };
}

// -- Public API --------------------------------------------------------------

export type SyncResult = {
  success: boolean;
  issueCount: number;
  commentCount: number;
  teamCount: number;
  projectCount: number;
  initiativeCount: number;
  error?: string;
};

/**
 * Batch upsert helper — upserts rows in chunks of BATCH_SIZE.
 */
export async function batchUpsert(
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string
): Promise<void> {
  const BATCH_SIZE = 50;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabaseAdmin
      .from(table)
      .upsert(batch, { onConflict });

    if (error) {
      console.error(`${table} upsert batch error:`, error);
      throw error;
    }
  }
}

/**
 * Run initial sync: fetch all entities for a team from Linear
 * and upsert them into Supabase. Idempotent via unique constraints.
 */
export async function runInitialSync(
  apiToken: string,
  userId: string,
  teamId: string
): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    issueCount: 0,
    commentCount: 0,
    teamCount: 0,
    projectCount: 0,
    initiativeCount: 0,
  };

  try {
    // 1. Fetch and upsert teams (org-level, not team-scoped)
    const teams = await fetchAllTeams(apiToken);
    if (teams.length > 0) {
      await batchUpsert(
        "synced_teams",
        teams.map((t) => mapTeamToRow(t, userId)),
        "user_id,linear_id"
      );
    }
    result.teamCount = teams.length;

    // 2. Fetch and upsert projects (team-scoped)
    const projects = await fetchAllProjects(apiToken, teamId);
    if (projects.length > 0) {
      await batchUpsert(
        "synced_projects",
        projects.map((p) => mapProjectToRow(p, userId)),
        "user_id,linear_id"
      );
    }
    result.projectCount = projects.length;

    // 3. Fetch and upsert initiatives (org-level)
    try {
      const initiatives = await fetchAllInitiatives(apiToken);
      if (initiatives.length > 0) {
        await batchUpsert(
          "synced_initiatives",
          initiatives.map((i) => mapInitiativeToRow(i, userId)),
          "user_id,linear_id"
        );
      }
      result.initiativeCount = initiatives.length;
    } catch (err) {
      // Initiatives are org-level — token may not have scope. Log and continue.
      console.warn("Initiative sync failed (may lack org scope):", err);
    }

    // 4. Fetch and upsert issues
    const issues = await fetchAllIssues(apiToken, teamId);
    if (issues.length > 0) {
      await batchUpsert(
        "synced_issues",
        issues.map((issue) => mapIssueToRow(issue, userId)),
        "user_id,linear_id"
      );
    }
    result.issueCount = issues.length;

    // 5. Fetch and upsert comments for each issue
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
        } else {
          result.commentCount += comments.length;
        }
      }
    }

    result.success = true;
    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown sync error";
    console.error("Initial sync failed:", message);
    return { ...result, error: message };
  }
}
