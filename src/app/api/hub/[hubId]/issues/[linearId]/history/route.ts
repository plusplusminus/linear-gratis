import { NextResponse } from "next/server";
import { withHubAuth, type HubAuthError } from "@/lib/hub-auth";
import { getWorkspaceToken } from "@/lib/workspace";
import { supabaseAdmin, type HubWorkflowLog } from "@/lib/supabase";

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
  type: "state" | "priority" | "label" | "workflow";
  fromState?: { name: string; color: string; type: string };
  toState?: { name: string; color: string; type: string };
  fromPriority?: number;
  toPriority?: number;
  addedLabels?: Array<{ name: string; color: string }>;
  removedLabels?: Array<{ name: string; color: string }>;
  // Workflow-specific fields
  workflowActionType?: string;
  workflowActionConfig?: Record<string, unknown>;
  workflowResult?: "success" | "failure";
  workflowError?: string | null;
  workflowTriggerLabelId?: string;
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

    // Fetch Linear history and workflow logs in parallel
    const [linearResponse, workflowLogsResult] = await Promise.all([
      fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token.trim(),
        },
        body: JSON.stringify({
          query: `
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
          `,
          variables: { issueId: linearId },
        }),
      }),
      supabaseAdmin
        .from("hub_workflow_logs")
        .select("*")
        .eq("hub_id", hubId)
        .eq("issue_linear_id", linearId)
        .order("created_at", { ascending: true }),
    ]);

    if (!linearResponse.ok) {
      const errorText = await linearResponse.text();
      console.error("Linear API error (HTTP):", linearResponse.status, errorText);
      return NextResponse.json(
        { error: "Failed to fetch issue history" },
        { status: 502 }
      );
    }

    const result = (await linearResponse.json()) as {
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

    // Build entries from Linear history
    const entries: HistoryEntry[] = [];

    if (result.data?.issue) {
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
      }
    }

    // Merge workflow log entries into the timeline
    const workflowLogs = (workflowLogsResult.data ?? []) as HubWorkflowLog[];
    for (const log of workflowLogs) {
      entries.push({
        id: `wf-${log.id}`,
        createdAt: log.created_at,
        type: "workflow",
        workflowActionType: log.action_type,
        workflowActionConfig: log.action_config,
        workflowResult: log.result,
        workflowError: log.error_message,
        workflowTriggerLabelId: log.trigger_label_id,
      });
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
