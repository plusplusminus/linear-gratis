"use client";

import { useFetch } from "@/hooks/use-fetch";
import { PickerShell, PickerItem } from "./picker-shell";

interface SyncedTeam {
  linear_id: string;
  name: string;
  key: string;
  data: {
    id?: string;
    name?: string;
    key?: string;
    color?: string;
    icon?: string;
  };
}

interface TeamPickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
}

export function TeamPicker({ value, onChange }: TeamPickerProps) {
  const { data, loading, error, refetch } = useFetch<SyncedTeam[]>(
    "/api/admin/linear/teams"
  );

  const teams = data ?? [];

  function toggle(id: string) {
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id]
    );
  }

  return (
    <PickerShell
      label="Teams"
      loading={loading}
      error={error}
      onRetry={refetch}
      empty={teams.length === 0}
      emptyMessage="No teams found. Check your Linear API token in Settings."
      searchPlaceholder="Filter teams..."
    >
      {(filter) => {
        const filtered = teams.filter(
          (t) =>
            t.name.toLowerCase().includes(filter.toLowerCase()) ||
            (t.key ?? "").toLowerCase().includes(filter.toLowerCase())
        );

        if (filtered.length === 0) {
          return (
            <div className="px-3 py-3 text-xs text-muted-foreground text-center">
              No teams match &quot;{filter}&quot;
            </div>
          );
        }

        return filtered.map((team) => (
          <PickerItem
            key={team.linear_id}
            selected={value.includes(team.linear_id)}
            onToggle={() => toggle(team.linear_id)}
          >
            <span className="flex items-center gap-2 min-w-0">
              {team.data.color && (
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: team.data.color }}
                />
              )}
              <span className="truncate">{team.name}</span>
              {team.key && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {team.key}
                </span>
              )}
            </span>
          </PickerItem>
        ));
      }}
    </PickerShell>
  );
}
