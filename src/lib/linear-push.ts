import { getWorkspaceToken } from "./workspace";
import { getWriteToken } from "./linear-oauth";
import { LinearRateLimiter } from "./linear-rate-limiter";

const LINEAR_API = "https://api.linear.app/graphql";

/**
 * Thrown when a push operation is skipped because the rate limiter
 * indicates we're too close to the budget ceiling. Callers can catch
 * this specifically to log "deferred" instead of "error".
 */
export class RateLimitDeferredError extends Error {
  readonly isRateLimitDeferred = true as const;
  constructor(message: string) {
    super(message);
    this.name = "RateLimitDeferredError";
  }
}

/**
 * Author attribution info for createAsUser (OAuth app tokens only).
 */
export type AuthorAttribution = {
  authorName: string;
  authorAvatarUrl?: string;
};

/**
 * Resolve the appropriate token for a write operation.
 * Only looks up the OAuth app token when author info is provided
 * (avoids unnecessary DB lookups otherwise).
 */
async function resolveWriteToken(
  author?: AuthorAttribution
): Promise<{ token: string; isOAuthApp: boolean }> {
  if (author) {
    return getWriteToken();
  }
  return { token: await getWorkspaceToken(), isOAuthApp: false };
}

// -- Comment mutations ────────────────────────────────────────────────────────

const COMMENT_CREATE_MUTATION = `
  mutation CommentCreate($issueId: String!, $body: String!, $parentId: String, $createAsUser: String, $displayIconUrl: String) {
    commentCreate(input: { issueId: $issueId, body: $body, parentId: $parentId, createAsUser: $createAsUser, displayIconUrl: $displayIconUrl }) {
      success
      comment {
        id
      }
    }
  }
`;

const COMMENT_CREATE_AS_USER_MUTATION = `
  mutation CommentCreateAsUser($issueId: String!, $body: String!, $parentId: String, $createAsUser: String!, $displayIconUrl: String) {
    commentCreate(input: { issueId: $issueId, body: $body, parentId: $parentId, createAsUser: $createAsUser, displayIconUrl: $displayIconUrl }) {
      success
      comment {
        id
      }
    }
  }
`;

/**
 * Push a comment to Linear via GraphQL API.
 * When an OAuth app token is available, uses createAsUser for proper attribution.
 * Falls back to personal token with bold author prefix if OAuth is not configured.
 *
 * Retries up to 3 times on rate limit errors with exponential backoff.
 * Returns the Linear comment ID on success, or throws on failure.
 */
export async function pushCommentToLinear(
  issueLinearId: string,
  body: string,
  parentId?: string,
  rateLimiter?: LinearRateLimiter,
  author?: AuthorAttribution
): Promise<string> {
  if (rateLimiter && !rateLimiter.canProceed()) {
    throw new RateLimitDeferredError("pushCommentToLinear deferred due to rate limit");
  }

  const { token, isOAuthApp } = await resolveWriteToken(author);

  // If using OAuth app token, use createAsUser for attribution.
  // If using personal token, fall back to bold prefix in body.
  let commentBody = body;
  let createAsUser: string | null = null;
  let displayIconUrl: string | null = null;

  if (isOAuthApp && author) {
    createAsUser = author.authorName;
    displayIconUrl = author.authorAvatarUrl ?? null;
  } else if (author) {
    // Fallback: prepend bold author name to body
    commentBody = `**${author.authorName}:** ${body}`;
  }

  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(LINEAR_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: isOAuthApp ? `Bearer ${token}` : token.trim(),
      },
      body: JSON.stringify({
        query: COMMENT_CREATE_MUTATION,
        variables: {
          issueId: issueLinearId,
          body: commentBody,
          parentId: parentId ?? null,
          createAsUser,
          displayIconUrl,
        },
      }),
    });

    if (rateLimiter) {
      rateLimiter.updateFromResponse(res);
    }

    if (res.status === 429 || (res.status === 400 && attempt < MAX_RETRIES)) {
      const retryAfter = res.headers.get("retry-after");
      const delayMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : 1000 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }

    if (!res.ok) {
      throw new Error(`Linear API ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as {
      data?: {
        commentCreate?: {
          success: boolean;
          comment?: { id: string };
        };
      };
      errors?: Array<{ message: string; extensions?: { code?: string } }>;
    };

    if (json.errors?.some((e) => e.extensions?.code === "RATELIMITED") && attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      continue;
    }

    if (json.errors) {
      throw new Error(`GraphQL: ${json.errors.map((e) => e.message).join(", ")}`);
    }

    if (!json.data?.commentCreate?.success || !json.data.commentCreate.comment) {
      throw new Error("Linear commentCreate returned unsuccessful");
    }

    return json.data.commentCreate.comment.id;
  }

  throw new Error("Linear rate limit: max retries exceeded");
}

// -- Label updates ────────────────────────────────────────────────────────────

const ISSUE_UPDATE_LABELS_MUTATION = `
  mutation IssueUpdateLabels($issueId: String!, $labelIds: [String!]!) {
    issueUpdate(id: $issueId, input: { labelIds: $labelIds }) {
      success
      issue {
        id
        labels {
          nodes {
            id
            name
            color
          }
        }
      }
    }
  }
`;

/**
 * Update labels on a Linear issue.
 * Uses the personal workspace token intentionally — label updates are admin
 * operations with no createAsUser support on issueUpdate, so the OAuth app
 * token would add no attribution value.
 */
export async function updateIssueLabels(
  issueLinearId: string,
  labelIds: string[],
  rateLimiter?: LinearRateLimiter
): Promise<Array<{ id: string; name: string; color: string }>> {
  if (rateLimiter && !rateLimiter.canProceed()) {
    throw new RateLimitDeferredError("updateIssueLabels deferred due to rate limit");
  }

  const token = await getWorkspaceToken();

  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token.trim(),
    },
    body: JSON.stringify({
      query: ISSUE_UPDATE_LABELS_MUTATION,
      variables: { issueId: issueLinearId, labelIds },
    }),
  });

  // Track rate limit headers
  if (rateLimiter) {
    rateLimiter.updateFromResponse(res);
  }

  if (!res.ok) {
    throw new Error(`Linear API ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    data?: {
      issueUpdate?: {
        success: boolean;
        issue?: {
          labels?: { nodes: Array<{ id: string; name: string; color: string }> };
        };
      };
    };
    errors?: Array<{ message: string }>;
  };

  if (json.errors) {
    throw new Error(`GraphQL: ${json.errors.map((e) => e.message).join(", ")}`);
  }

  if (!json.data?.issueUpdate?.success) {
    throw new Error("Linear issueUpdate returned unsuccessful");
  }

  return json.data.issueUpdate.issue?.labels?.nodes ?? [];
}

// -- Issue creation ──────────────────────────────────────────────────────────

const ISSUE_CREATE_MUTATION = `
  mutation IssueCreate(
    $teamId: String!,
    $title: String!,
    $description: String,
    $priority: Int,
    $labelIds: [String!],
    $projectId: String,
    $stateId: String,
    $cycleId: String,
    $createAsUser: String,
    $displayIconUrl: String
  ) {
    issueCreate(input: {
      teamId: $teamId,
      title: $title,
      description: $description,
      priority: $priority,
      labelIds: $labelIds,
      projectId: $projectId,
      stateId: $stateId,
      cycleId: $cycleId,
      createAsUser: $createAsUser,
      displayIconUrl: $displayIconUrl
    }) {
      success
      issue {
        id
        identifier
        title
        priority
        priorityLabel
        url
        state {
          id
          name
          color
          type
        }
        labels {
          nodes {
            id
            name
            color
          }
        }
        createdAt
      }
    }
  }
`;

const ISSUE_CREATE_AS_USER_MUTATION = `
  mutation IssueCreateAsUser(
    $teamId: String!,
    $title: String!,
    $description: String,
    $priority: Int,
    $labelIds: [String!],
    $projectId: String,
    $stateId: String,
    $cycleId: String,
    $createAsUser: String!,
    $displayIconUrl: String
  ) {
    issueCreate(input: {
      teamId: $teamId,
      title: $title,
      description: $description,
      priority: $priority,
      labelIds: $labelIds,
      projectId: $projectId,
      stateId: $stateId,
      cycleId: $cycleId,
      createAsUser: $createAsUser,
      displayIconUrl: $displayIconUrl
    }) {
      success
      issue {
        id
        identifier
        title
        priority
        priorityLabel
        url
        state {
          id
          name
          color
          type
        }
        labels {
          nodes {
            id
            name
            color
          }
        }
        createdAt
      }
    }
  }
`;

export type CreateIssueParams = {
  teamId: string;
  title: string;
  description?: string;
  priority?: number;
  labelIds?: string[];
  projectId?: string;
  stateId?: string;
  cycleId?: string;
};

export type CreatedIssue = {
  id: string;
  identifier: string;
  title: string;
  priority: number;
  priorityLabel: string;
  url: string;
  state: { id: string; name: string; color: string; type: string };
  labels: Array<{ id: string; name: string; color: string }>;
  createdAt: string;
};

/**
 * Create an issue in Linear via GraphQL API.
 * When an OAuth app token is available and author is provided,
 * uses createAsUser for proper attribution.
 * When using personal token with author, prepends author name to description.
 *
 * Returns the created issue data on success, or throws on failure.
 */
export async function createIssueInLinear(
  params: CreateIssueParams,
  rateLimiter?: LinearRateLimiter,
  author?: AuthorAttribution
): Promise<CreatedIssue> {
  if (rateLimiter && !rateLimiter.canProceed()) {
    throw new RateLimitDeferredError("createIssueInLinear deferred due to rate limit");
  }

  const { token, isOAuthApp } = await resolveWriteToken(author);

  let createAsUser: string | undefined;
  let displayIconUrl: string | undefined;
  let description = params.description;

  if (isOAuthApp && author) {
    createAsUser = author.authorName;
    displayIconUrl = author.authorAvatarUrl;
  } else if (author) {
    // Fallback: prepend author attribution to description
    const prefix = `*Submitted by ${author.authorName}*`;
    description = description ? `${prefix}\n\n${description}` : prefix;
  }

  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: isOAuthApp ? `Bearer ${token}` : token.trim(),
    },
    body: JSON.stringify({
      query: ISSUE_CREATE_MUTATION,
      variables: {
        teamId: params.teamId,
        title: params.title,
        description: description ?? undefined,
        priority: params.priority ?? undefined,
        labelIds: params.labelIds?.length ? params.labelIds : undefined,
        projectId: params.projectId ?? undefined,
        stateId: params.stateId ?? undefined,
        cycleId: params.cycleId ?? undefined,
        createAsUser: createAsUser ?? undefined,
        displayIconUrl: displayIconUrl ?? undefined,
      },
    }),
  });

  if (rateLimiter) {
    rateLimiter.updateFromResponse(res);
  }

  if (!res.ok) {
    throw new Error(`Linear API ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    data?: {
      issueCreate?: {
        success: boolean;
        issue?: {
          id: string;
          identifier: string;
          title: string;
          priority: number;
          priorityLabel: string;
          url: string;
          state: { id: string; name: string; color: string; type: string };
          labels: { nodes: Array<{ id: string; name: string; color: string }> };
          createdAt: string;
        };
      };
    };
    errors?: Array<{ message: string }>;
  };

  if (json.errors) {
    throw new Error(`GraphQL: ${json.errors.map((e) => e.message).join(", ")}`);
  }

  if (!json.data?.issueCreate?.success || !json.data.issueCreate.issue) {
    throw new Error("Linear issueCreate returned unsuccessful");
  }

  const issue = json.data.issueCreate.issue;
  return {
    id: issue.id,
    identifier: issue.identifier,
    title: issue.title,
    priority: issue.priority,
    priorityLabel: issue.priorityLabel,
    url: issue.url,
    state: issue.state,
    labels: issue.labels.nodes,
    createdAt: issue.createdAt,
  };
}
