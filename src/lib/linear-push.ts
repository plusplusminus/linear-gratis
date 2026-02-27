import { getWorkspaceToken } from "./workspace";

const LINEAR_API = "https://api.linear.app/graphql";

const COMMENT_CREATE_MUTATION = `
  mutation CommentCreate($issueId: String!, $body: String!) {
    commentCreate(input: { issueId: $issueId, body: $body }) {
      success
      comment {
        id
      }
    }
  }
`;

/**
 * Push a comment to Linear via GraphQL API.
 * Returns the Linear comment ID on success, or throws on failure.
 */
export async function pushCommentToLinear(
  issueLinearId: string,
  body: string
): Promise<string> {
  const token = await getWorkspaceToken();

  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token.trim(),
    },
    body: JSON.stringify({
      query: COMMENT_CREATE_MUTATION,
      variables: { issueId: issueLinearId, body },
    }),
  });

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
    errors?: Array<{ message: string }>;
  };

  if (json.errors) {
    throw new Error(`GraphQL: ${json.errors.map((e) => e.message).join(", ")}`);
  }

  if (!json.data?.commentCreate?.success || !json.data.commentCreate.comment) {
    throw new Error("Linear commentCreate returned unsuccessful");
  }

  return json.data.commentCreate.comment.id;
}

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
 * Returns the updated label list on success.
 */
export async function updateIssueLabels(
  issueLinearId: string,
  labelIds: string[]
): Promise<Array<{ id: string; name: string; color: string }>> {
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
    $projectId: String
  ) {
    issueCreate(input: {
      teamId: $teamId,
      title: $title,
      description: $description,
      priority: $priority,
      labelIds: $labelIds,
      projectId: $projectId
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
 * Returns the created issue data on success, or throws on failure.
 */
export async function createIssueInLinear(
  params: CreateIssueParams
): Promise<CreatedIssue> {
  const token = await getWorkspaceToken();

  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token.trim(),
    },
    body: JSON.stringify({
      query: ISSUE_CREATE_MUTATION,
      variables: {
        teamId: params.teamId,
        title: params.title,
        description: params.description ?? undefined,
        priority: params.priority ?? undefined,
        labelIds: params.labelIds?.length ? params.labelIds : undefined,
        projectId: params.projectId ?? undefined,
      },
    }),
  });

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
