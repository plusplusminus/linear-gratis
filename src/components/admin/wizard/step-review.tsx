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

        {/* Teams & scoping */}
        <div className="border border-border rounded-lg bg-card">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="text-xs text-muted-foreground">
              {state.selectedTeamIds.length} team
              {state.selectedTeamIds.length !== 1 ? "s" : ""}
            </p>
          </div>
          {state.selectedTeamIds.map((teamId) => {
            const scoping = state.teamScopings[teamId];
            return (
              <div
                key={teamId}
                className="px-4 py-3 border-b border-border last:border-b-0"
              >
                <p className="text-sm font-medium">
                  {scoping?.teamName || teamId}
                </p>
                <div className="flex gap-4 mt-1">
                  <ScopingStat
                    label="Projects"
                    count={scoping?.visibleProjectIds.length ?? 0}
                  />
                  <ScopingStat
                    label="Labels"
                    count={scoping?.visibleLabelIds.length ?? 0}
                  />
                  <ScopingStat
                    label="Initiatives"
                    count={scoping?.visibleInitiativeIds.length ?? 0}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ScopingStat({ label, count }: { label: string; count: number }) {
  return (
    <span className="text-xs text-muted-foreground">
      {label}: <span className="text-foreground font-medium">{count === 0 ? "All" : count}</span>
    </span>
  );
}
