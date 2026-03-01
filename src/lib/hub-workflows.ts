import { getWorkspaceToken } from "./workspace";
import type { HubWorkflowRule, WorkflowActionType } from "./supabase";

const LINEAR_API = "https://api.linear.app/graphql";

// -- Types -------------------------------------------------------------------

export type LabelChangeContext = {
  previousLabelIds: string[];
  newLabelIds: string[];
  addedLabelIds: string[];
  removedLabelIds: string[];
};

export type WorkflowAction = {
  ruleId: string;
  actionType: WorkflowActionType;
  actionConfig: Record<string, unknown>;
};

export type WorkflowExecutionResult = {
  ruleId: string;
  action: string;
  success: boolean;
  error?: string;
  details?: Record<string, unknown>;
};

// -- Helpers -----------------------------------------------------------------

/**
 * Compute added/removed label sets from previous and new label arrays.
 */
export function buildLabelChangeContext(
  previousLabelIds: string[],
  newLabelIds: string[]
): LabelChangeContext {
  const prevSet = new Set(previousLabelIds);
  const newSet = new Set(newLabelIds);

  const addedLabelIds = newLabelIds.filter((id) => !prevSet.has(id));
  const removedLabelIds = previousLabelIds.filter((id) => !newSet.has(id));

  return { previousLabelIds, newLabelIds, addedLabelIds, removedLabelIds };
}

// -- Evaluation --------------------------------------------------------------

/**
 * Pure function: match label changes against workflow rules, returning actions
 * for every rule that fires.
 */
export function evaluateWorkflowRules(
  context: LabelChangeContext,
  rules: HubWorkflowRule[]
): WorkflowAction[] {
  const actions: WorkflowAction[] = [];

  for (const rule of rules) {
    let matches = false;

    switch (rule.trigger_type) {
      case "label_added":
        matches = context.addedLabelIds.includes(rule.trigger_label_id);
        break;

      case "label_removed":
        matches = context.removedLabelIds.includes(rule.trigger_label_id);
        break;

      case "label_changed":
        matches =
          rule.trigger_from_label_id !== null &&
          context.previousLabelIds.includes(rule.trigger_from_label_id) &&
          context.newLabelIds.includes(rule.trigger_label_id) &&
          !context.newLabelIds.includes(rule.trigger_from_label_id);
        break;
    }

    if (matches) {
      actions.push({
        ruleId: rule.id,
        actionType: rule.action_type,
        actionConfig: rule.action_config,
      });
    }
  }

  return actions;
}

// -- Execution ---------------------------------------------------------------

const ISSUE_UPDATE_STATE_MUTATION = `
  mutation IssueUpdateState($issueId: String!, $stateId: String!) {
    issueUpdate(id: $issueId, input: { stateId: $stateId }) {
      success
      issue {
        id
        state {
          id
          name
        }
      }
    }
  }
`;

/**
 * Execute workflow actions against the Linear API.
 * Each action is independent — failures are logged and do not block others.
 */
export async function executeWorkflowActions(
  actions: WorkflowAction[],
  issueLinearId: string
): Promise<WorkflowExecutionResult[]> {
  const token = await getWorkspaceToken();
  const results: WorkflowExecutionResult[] = [];

  for (const action of actions) {
    try {
      switch (action.actionType) {
        case "set_status": {
          const stateId = action.actionConfig.stateId as string | undefined;
          if (!stateId) {
            results.push({
              ruleId: action.ruleId,
              action: action.actionType,
              success: false,
              error: "Missing stateId in action_config",
            });
            break;
          }

          const res = await fetch(LINEAR_API, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: token.trim(),
            },
            body: JSON.stringify({
              query: ISSUE_UPDATE_STATE_MUTATION,
              variables: { issueId: issueLinearId, stateId },
            }),
          });

          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Linear API ${res.status}: ${text}`);
          }

          const json = (await res.json()) as {
            data?: {
              issueUpdate?: {
                success: boolean;
                issue?: { id: string; state: { id: string; name: string } };
              };
            };
            errors?: Array<{ message: string }>;
          };

          if (json.errors) {
            throw new Error(
              `GraphQL: ${json.errors.map((e) => e.message).join(", ")}`
            );
          }

          if (!json.data?.issueUpdate?.success) {
            throw new Error("issueUpdate returned unsuccessful");
          }

          const state = json.data.issueUpdate.issue?.state;
          results.push({
            ruleId: action.ruleId,
            action: action.actionType,
            success: true,
            details: {
              stateId: state?.id,
              stateName: state?.name,
            },
          });
          break;
        }

        default:
          results.push({
            ruleId: action.ruleId,
            action: action.actionType,
            success: false,
            error: `Unknown action type: ${action.actionType}`,
          });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[hub-workflows] Action failed: rule=${action.ruleId} issue=${issueLinearId} action=${action.actionType} error=${message}`
      );
      results.push({
        ruleId: action.ruleId,
        action: action.actionType,
        success: false,
        error: message,
      });
    }
  }

  return results;
}
