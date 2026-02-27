import { NextResponse } from "next/server";
import { withHubAuth, type HubAuthError } from "@/lib/hub-auth";
import { getWorkspaceToken } from "@/lib/workspace";

type HistoryNode = {
  id: string;
  createdAt: string;
  fromState?: { name: string; color: string; type: string } | null;
  toState?: { name: string; color: string; type: string } | null;
  fromPriority?: number | null;
  toPriority?: number | null;
  addedLabels?: Array<{ name: string; color: string }>;
  removedLabels?: Array<{ name: string; color: string }>;
  // Assignee fields — fetched but filtered out
  fromAssignee?: unknown;
  toAssignee?: unknown;
};

type HistoryEntry = {
  id: string;
  createdAt: string;
  type: "state" | "priority" | "label";
  fromState?: { name: string; color: string; type: string };
  toState?: { name: string; color: string; type: string };
  fromPriority?: number;
  toPriority?: number;
  addedLabels?: Array<{ name: string; color: string }>;
  removedLabels?: Array<{ name: string; color: string }>;
};

const PRIORITY_LABELS: Record<number, string> = {
  0: "No priority",
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hubId: string; linearId: string }> }
) {
  try {
    const { hubId, linearId } = await params;

    const auth = await withHubAuth(hubId);
    if ("error" in auth) {
      return NextResponse.json(
        { error: (auth as HubAuthError).error },
        { status: (auth as HubAuthError).status }
      );
    }

    const token = await getWorkspaceToken();

    const query = `
      query IssueHistory($issueId: String!) {
        issue(id: $issueId) {
          history(first: 50) {
            nodes {
              id
              createdAt
              fromState { name color type }
              toState { name color type }
              fromPriority
              toPriority
              addedLabels { name color }
              removedLabels { name color }
              fromAssignee { id }
              toAssignee { id }
            }
          }
        }
      }
    `;

    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token.trim(),
      },
      body: JSON.stringify({
        query,
        variables: { issueId: linearId },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Linear API error (HTTP):", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to fetch issue history" },
        { status: 502 }
      );
    }

    const result = (await response.json()) as {
      data?: {
        issue?: {
          history: {
            nodes: HistoryNode[];
          };
        } | null;
      };
      errors?: Array<{ message: string }>;
    };

    if (result.errors) {
      console.error("GraphQL errors for issue", linearId, ":", JSON.stringify(result.errors));
      return NextResponse.json(
        { error: "Failed to fetch issue history" },
        { status: 502 }
      );
    }

    if (!result.data?.issue) {
      // Issue not found in Linear — return empty history instead of 502
      return NextResponse.json({ history: [], priorityLabels: PRIORITY_LABELS });
    }

    // Filter: only keep state, priority, and label changes.
    // Exclude assignee changes (client privacy).
    const entries: HistoryEntry[] = [];

    for (const node of result.data.issue.history.nodes) {
      // State change
      if (node.fromState || node.toState) {
        entries.push({
          id: node.id,
          createdAt: node.createdAt,
          type: "state",
          fromState: node.fromState ?? undefined,
          toState: node.toState ?? undefined,
        });
        continue;
      }

      // Priority change
      if (node.fromPriority != null || node.toPriority != null) {
        // Skip if both are the same (no real change)
        if (node.fromPriority === node.toPriority) continue;
        entries.push({
          id: node.id,
          createdAt: node.createdAt,
          type: "priority",
          fromPriority: node.fromPriority ?? undefined,
          toPriority: node.toPriority ?? undefined,
        });
        continue;
      }

      // Label changes
      const added = node.addedLabels ?? [];
      const removed = node.removedLabels ?? [];
      if (added.length > 0 || removed.length > 0) {
        entries.push({
          id: node.id,
          createdAt: node.createdAt,
          type: "label",
          addedLabels: added.length > 0 ? added : undefined,
          removedLabels: removed.length > 0 ? removed : undefined,
        });
        continue;
      }

      // Skip everything else (assignee changes, etc.)
    }

    // Sort chronologically (oldest first)
    entries.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return NextResponse.json({
      history: entries,
      priorityLabels: PRIORITY_LABELS,
    });
  } catch (error) {
    console.error("GET /api/hub/[hubId]/issues/[linearId]/history error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
