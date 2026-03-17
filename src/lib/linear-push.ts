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
 * Generate a fallback avatar URL from a name using ui-avatars.com.
 * Returns a colored initial-based avatar matching Linear's purple theme.
 */
function generateAvatarUrl(name: string): string {
  const encoded = encodeURIComponent(name.trim());
  return `https://ui-avatars.com/api/?name=${encoded}&size=64&background=5E6AD2&color=fff&bold=true`;
}

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

/**
 * Format the Authorization header value.
 * OAuth app tokens use Bearer prefix. Personal API keys are sent raw
 * (Linear rejects Bearer prefix on API keys).
 */
function authHeader(token: string, isOAuthApp: boolean): string {
  return isOAuthApp ? `Bearer ${token.trim()}` : token.trim();
}

// -- Comment mutations ────────────────────────────────────────────────────────

const COMMENT_CREATE_MUTATION = `
  mutation CommentCreate($issueId: String!, $body: String!, $parentId: String) {
    commentCreate(input: { issueId: $issueId, body: $body, parentId: $parentId }) {
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
 * Execute a commentCreate mutation against Linear with rate-limit retry logic.
 * Returns the comment ID on success, or throws.
 */
async function executeCommentCreate(
  authorization: string,
  query: string,
  variables: Record<string, unknown>,
  rateLimiter?: LinearRateLimiter
): Promise<string> {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(LINEAR_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body: JSON.stringify({ query, variables }),
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

/**
 * Push a comment to Linear via GraphQL API.
 * When an OAuth app token is available, tries createAsUser for proper attribution.
 * If Linear rejects createAsUser (e.g. not supported for this token type),
 * falls back to bold author prefix in the comment body.
 *
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
  const trimmedAuthorName = author?.authorName?.trim() || null;
  const baseVars = { issueId: issueLinearId, parentId: parentId ?? null };

  // Try createAsUser attribution with OAuth app token
  if (isOAuthApp && trimmedAuthorName) {
    try {
      // Direct single-attempt call (no retries) — if createAsUser isn't
      // supported, we want to fail fast and fall back, not retry 3 times.
      const res = await fetch(LINEAR_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token.trim()}`,
        },
        body: JSON.stringify({
          query: COMMENT_CREATE_AS_USER_MUTATION,
          variables: {
            ...baseVars,
            body,
            createAsUser: trimmedAuthorName,
            displayIconUrl: author?.authorAvatarUrl || generateAvatarUrl(trimmedAuthorName),
          },
        }),
      });

      const json = (await res.json()) as {
        data?: { commentCreate?: { success: boolean; comment?: { id: string } } };
        errors?: Array<{ message: string; extensions?: { code?: string } }>;
      };

      if (json.data?.commentCreate?.success && json.data.commentCreate.comment) {
        return json.data.commentCreate.comment.id;
      }

      // Log the full error for debugging
      const errorDetail = json.errors
        ? JSON.stringify(json.errors)
        : `status=${res.status}, success=${json.data?.commentCreate?.success}`;
      console.warn("createAsUser attempt failed, falling back to bold prefix. Error:", errorDetail);
    } catch (err) {
      console.warn("createAsUser attempt threw, falling back to bold prefix:", err);
    }
  }

  // Fallback: bold author prefix in body (or plain body if no author)
  const commentBody = trimmedAuthorName
    ? `**${trimmedAuthorName}:** ${body}`
    : body;

  return executeCommentCreate(
    authHeader(token, isOAuthApp),
    COMMENT_CREATE_MUTATION,
    { ...baseVars, body: commentBody },
    rateLimiter
  );
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
      Authorization: authHeader(token, false),
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
    $cycleId: String
  ) {
    issueCreate(input: {
      teamId: $teamId,
      title: $title,
      description: $description,
      priority: $priority,
      labelIds: $labelIds,
      projectId: $projectId,
      stateId: $stateId,
      cycleId: $cycleId
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
/**
 * Execute an issueCreate mutation against Linear.
 * Returns the created issue on success, or throws.
 */
async function executeIssueCreate(
  authorization: string,
  query: string,
  variables: Record<string, unknown>,
  rateLimiter?: LinearRateLimiter
): Promise<CreatedIssue> {
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify({ query, variables }),
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

/**
 * Create an issue in Linear via GraphQL API.
 * When an OAuth app token is available, tries createAsUser for proper attribution.
 * If Linear rejects createAsUser, falls back to description prefix.
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
  const trimmedAuthorName = author?.authorName?.trim() || null;

  const baseVars = {
    teamId: params.teamId,
    title: params.title,
    description: params.description ?? undefined,
    priority: params.priority ?? undefined,
    labelIds: params.labelIds?.length ? params.labelIds : undefined,
    projectId: params.projectId ?? undefined,
    stateId: params.stateId ?? undefined,
    cycleId: params.cycleId ?? undefined,
  };

  // Try createAsUser attribution with OAuth app token (single attempt, no retries)
  if (isOAuthApp && trimmedAuthorName) {
    try {
      const res = await fetch(LINEAR_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token.trim()}`,
        },
        body: JSON.stringify({
          query: ISSUE_CREATE_AS_USER_MUTATION,
          variables: {
            ...baseVars,
            createAsUser: trimmedAuthorName,
            displayIconUrl: author?.authorAvatarUrl || (trimmedAuthorName ? generateAvatarUrl(trimmedAuthorName) : undefined),
          },
        }),
      });

      if (rateLimiter) rateLimiter.updateFromResponse(res);

      const json = (await res.json()) as {
        data?: { issueCreate?: { success: boolean; issue?: CreatedIssue & { labels: { nodes: Array<{ id: string; name: string; color: string }> } } } };
        errors?: Array<{ message: string }>;
      };

      if (json.data?.issueCreate?.success && json.data.issueCreate.issue) {
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

      const errorDetail = json.errors
        ? JSON.stringify(json.errors)
        : `status=${res.status}, success=${json.data?.issueCreate?.success}`;
      console.warn("createAsUser attempt failed for issue, falling back. Error:", errorDetail);
    } catch (err) {
      console.warn("createAsUser attempt threw for issue, falling back:", err);
    }
  }

  // Fallback: prepend author to description (or plain if no author)
  if (trimmedAuthorName) {
    const prefix = `*Submitted by ${trimmedAuthorName}*`;
    baseVars.description = baseVars.description
      ? `${prefix}\n\n${baseVars.description}`
      : prefix;
  }

  return executeIssueCreate(authHeader(token, isOAuthApp), ISSUE_CREATE_MUTATION, baseVars, rateLimiter);
}
