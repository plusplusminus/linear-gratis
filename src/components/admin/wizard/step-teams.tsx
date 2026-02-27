"use client";

import { useEffect } from "react";
import { TeamPicker } from "@/components/admin/pickers";
import { useFetch } from "@/hooks/use-fetch";

interface SyncedTeam {
  linear_id: string;
  name: string;
  key: string;
}

interface StepTeamsProps {
  value: string[];
  onChange: (teamIds: string[]) => void;
  onTeamNameResolved: (teamId: string, teamName: string) => void;
}

export function StepTeams({ value, onChange, onTeamNameResolved }: StepTeamsProps) {
  const { data: teams } = useFetch<SyncedTeam[]>("/api/admin/linear/teams");

  // Resolve team names when teams data loads
  useEffect(() => {
    if (!teams) return;
    for (const id of value) {
      const team = teams.find((t) => t.linear_id === id);
      if (team) onTeamNameResolved(id, team.name);
    }
  }, [teams, value, onTeamNameResolved]);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1">Select teams</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Choose which Linear teams this client hub should have access to.
        Each team can only belong to one hub.
      </p>

      <TeamPicker value={value} onChange={onChange} />

      {value.length > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          {value.length} team{value.length !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  );
}
