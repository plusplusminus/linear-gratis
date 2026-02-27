"use client";

import { useReducer, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StepName } from "./step-name";
import { StepTeams } from "./step-teams";
import { StepScoping } from "./step-scoping";
import { StepReview } from "./step-review";
import { cn } from "@/lib/utils";
import { refreshAdminHubs } from "@/hooks/use-admin-hubs";

export interface TeamScoping {
  teamId: string;
  teamName: string;
  visibleProjectIds: string[];
  visibleInitiativeIds: string[];
  visibleLabelIds: string[];
}

export interface WizardState {
  step: number;
  name: string;
  selectedTeamIds: string[];
  teamScopings: Record<string, TeamScoping>;
}

type WizardAction =
  | { type: "SET_STEP"; step: number }
  | { type: "SET_NAME"; name: string }
  | { type: "SET_TEAMS"; teamIds: string[] }
  | { type: "SET_TEAM_NAME"; teamId: string; teamName: string }
  | {
      type: "SET_SCOPING";
      teamId: string;
      field: "visibleProjectIds" | "visibleInitiativeIds" | "visibleLabelIds";
      value: string[];
    };

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_NAME":
      return { ...state, name: action.name };
    case "SET_TEAMS": {
      // Clean up scopings for deselected teams
      const scopings = { ...state.teamScopings };
      for (const id of Object.keys(scopings)) {
        if (!action.teamIds.includes(id)) delete scopings[id];
      }
      // Initialize new scopings
      for (const id of action.teamIds) {
        if (!scopings[id]) {
          scopings[id] = {
            teamId: id,
            teamName: "",
            visibleProjectIds: [],
            visibleInitiativeIds: [],
            visibleLabelIds: [],
          };
        }
      }
      return { ...state, selectedTeamIds: action.teamIds, teamScopings: scopings };
    }
    case "SET_TEAM_NAME":
      return {
        ...state,
        teamScopings: {
          ...state.teamScopings,
          [action.teamId]: {
            ...state.teamScopings[action.teamId],
            teamName: action.teamName,
          },
        },
      };
    case "SET_SCOPING":
      return {
        ...state,
        teamScopings: {
          ...state.teamScopings,
          [action.teamId]: {
            ...state.teamScopings[action.teamId],
            [action.field]: action.value,
          },
        },
      };
    default:
      return state;
  }
}

const STEPS = ["Hub Name", "Select Teams", "Scoping", "Review"];

export function HubWizard() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);

  const [state, dispatch] = useReducer(reducer, {
    step: 0,
    name: "",
    selectedTeamIds: [],
    teamScopings: {},
  });

  const canNext =
    state.step === 0
      ? state.name.trim().length > 0
      : state.step === 1
        ? state.selectedTeamIds.length > 0
        : true;

  async function next() {
    if (state.step >= STEPS.length - 1) return;

    // When moving from teams → scoping, sync the selected teams first
    if (state.step === 1) {
      setSyncing(true);
      try {
        const res = await fetch("/api/admin/sync/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teamIds: state.selectedTeamIds }),
        });

        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Sync failed");
        }

        const data = (await res.json()) as {
          teamCount: number;
          projectCount: number;
          initiativeCount: number;
        };

        toast.success(
          `Synced ${data.teamCount} teams, ${data.projectCount} projects, ${data.initiativeCount} initiatives`
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to sync teams");
        setSyncing(false);
        return;
      } finally {
        setSyncing(false);
      }
    }

    dispatch({ type: "SET_STEP", step: state.step + 1 });
  }

  function back() {
    if (state.step > 0) {
      dispatch({ type: "SET_STEP", step: state.step - 1 });
    }
  }

  async function submit() {
    startTransition(async () => {
      try {
        // 1. Create the hub
        const hubRes = await fetch("/api/admin/hubs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: state.name.trim() }),
        });

        if (!hubRes.ok) {
          const err = (await hubRes.json()) as { error?: string };
          throw new Error(err.error ?? "Failed to create hub");
        }

        const hub = (await hubRes.json()) as { id: string };

        // 2. Add team mappings with scoping
        const teamErrors: string[] = [];

        for (const teamId of state.selectedTeamIds) {
          const scoping = state.teamScopings[teamId];
          const teamRes = await fetch(`/api/admin/hubs/${hub.id}/teams`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              linear_team_id: teamId,
              visible_project_ids: scoping?.visibleProjectIds ?? [],
              visible_initiative_ids: scoping?.visibleInitiativeIds ?? [],
              visible_label_ids: scoping?.visibleLabelIds ?? [],
            }),
          });

          if (!teamRes.ok) {
            const err = (await teamRes.json()) as { error?: string };
            teamErrors.push(
              `Team ${scoping?.teamName || teamId}: ${err.error ?? "Failed"}`
            );
          }
        }

        if (teamErrors.length > 0) {
          toast.warning("Hub created with some team mapping errors", {
            description: teamErrors.join("; "),
          });
        } else {
          toast.success("Hub created successfully");
        }

        await refreshAdminHubs();
        router.push(`/admin/hubs/${hub.id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create hub");
      }
    });
  }

  return (
    <div className="max-w-2xl">
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            <button
              onClick={() => i < state.step && dispatch({ type: "SET_STEP", step: i })}
              disabled={i > state.step}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors",
                i === state.step
                  ? "bg-primary text-primary-foreground"
                  : i < state.step
                    ? "bg-accent text-foreground hover:bg-accent/80 cursor-pointer"
                    : "text-muted-foreground"
              )}
            >
              <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[10px] shrink-0"
                style={
                  i === state.step
                    ? { borderColor: "transparent", backgroundColor: "rgba(255,255,255,0.2)" }
                    : i < state.step
                      ? { borderColor: "var(--primary)", color: "var(--primary)" }
                      : {}
                }
              >
                {i < state.step ? "✓" : i + 1}
              </span>
              {label}
            </button>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "w-6 h-px",
                i < state.step ? "bg-primary" : "bg-border"
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="mb-8">
        {state.step === 0 && (
          <StepName
            value={state.name}
            onChange={(name) => dispatch({ type: "SET_NAME", name })}
          />
        )}
        {state.step === 1 && (
          <StepTeams
            value={state.selectedTeamIds}
            onChange={(teamIds) => dispatch({ type: "SET_TEAMS", teamIds })}
            onTeamNameResolved={(teamId, teamName) =>
              dispatch({ type: "SET_TEAM_NAME", teamId, teamName })
            }
          />
        )}
        {state.step === 2 && (
          <StepScoping
            teamIds={state.selectedTeamIds}
            teamScopings={state.teamScopings}
            onScopingChange={(teamId, field, value) =>
              dispatch({ type: "SET_SCOPING", teamId, field, value })
            }
          />
        )}
        {state.step === 3 && <StepReview state={state} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={back}
          disabled={state.step === 0}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-md transition-colors",
            state.step === 0
              ? "text-muted-foreground/40 cursor-not-allowed"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          Back
        </button>

        {state.step < STEPS.length - 1 ? (
          <button
            onClick={next}
            disabled={!canNext || syncing}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors",
              canNext && !syncing
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {syncing ? "Syncing teams..." : "Next"}
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Creating..." : "Create Hub"}
          </button>
        )}
      </div>
    </div>
  );
}
