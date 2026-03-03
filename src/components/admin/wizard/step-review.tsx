"use client";

import type { WizardState } from "./hub-wizard";

interface StepReviewProps {
  state: WizardState;
}

export function StepReview({ state }: StepReviewProps) {
  const slug = state.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Review & create</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Confirm the hub configuration before creating.
      </p>

      <div className="space-y-4">
        {/* Hub info */}
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-xs text-muted-foreground mb-1">Hub</p>
          <p className="text-sm font-medium">{state.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            /{slug}
          </p>
        </div>

        {/* Teams */}
        <div className="border border-border rounded-lg bg-card">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="text-xs text-muted-foreground">
              {state.selectedTeamIds.length} team
              {state.selectedTeamIds.length !== 1 ? "s" : ""}
            </p>
          </div>
          {state.selectedTeamIds.map((teamId) => (
            <div
              key={teamId}
              className="px-4 py-3 border-b border-border last:border-b-0"
            >
              <p className="text-sm font-medium">
                {state.teamNames[teamId] || teamId}
              </p>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          You can configure project, label, and initiative scoping in hub settings after creation.
        </p>
      </div>
    </div>
  );
}
