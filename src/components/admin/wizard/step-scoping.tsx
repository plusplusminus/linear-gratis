"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ProjectPicker, InitiativePicker, LabelPicker } from "@/components/admin/pickers";
import type { TeamScoping } from "./hub-wizard";

interface StepScopingProps {
  teamIds: string[];
  teamScopings: Record<string, TeamScoping>;
  onScopingChange: (
    teamId: string,
    field: "visibleProjectIds" | "visibleInitiativeIds" | "visibleLabelIds",
    value: string[]
  ) => void;
}

export function StepScoping({
  teamIds,
  teamScopings,
  onScopingChange,
}: StepScopingProps) {
  const [activeTeam, setActiveTeam] = useState(teamIds[0] ?? null);

  if (teamIds.length === 0) return null;

  const scoping = activeTeam ? teamScopings[activeTeam] : null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Configure scoping</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Choose which projects, initiatives, and labels are visible to the client
        for each team. Leave empty to show all.
      </p>

      {/* Team tabs */}
      {teamIds.length > 1 && (
        <div className="flex gap-1 border-b border-border mb-4">
          {teamIds.map((id) => {
            const name = teamScopings[id]?.teamName || id.slice(0, 8);
            return (
              <button
                key={id}
                onClick={() => setActiveTeam(id)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                  activeTeam === id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      {activeTeam && scoping && (
        <div className="space-y-4">
          <ProjectPicker
            teamId={activeTeam}
            value={scoping.visibleProjectIds}
            onChange={(ids) =>
              onScopingChange(activeTeam, "visibleProjectIds", ids)
            }
          />
          <LabelPicker
            teamId={activeTeam}
            value={scoping.visibleLabelIds}
            onChange={(ids) =>
              onScopingChange(activeTeam, "visibleLabelIds", ids)
            }
          />
          <InitiativePicker
            value={scoping.visibleInitiativeIds}
            onChange={(ids) =>
              onScopingChange(activeTeam, "visibleInitiativeIds", ids)
            }
          />
        </div>
      )}
    </div>
  );
}
