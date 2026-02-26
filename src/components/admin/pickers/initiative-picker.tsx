"use client";

import { useFetch } from "@/hooks/use-fetch";
import { PickerShell, PickerItem } from "./picker-shell";

interface SyncedInitiative {
  linear_id: string;
  name: string;
  status: string | null;
  data: {
    id?: string;
    name?: string;
    color?: string;
    icon?: string;
    status?: string;
  };
}

interface InitiativePickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
}

export function InitiativePicker({ value, onChange }: InitiativePickerProps) {
  const { data, loading, error, refetch } = useFetch<SyncedInitiative[]>(
    "/api/admin/linear/initiatives"
  );

  const initiatives = data ?? [];

  function toggle(id: string) {
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id]
    );
  }

  return (
    <PickerShell
      label="Initiatives"
      loading={loading}
      error={error}
      onRetry={refetch}
      empty={initiatives.length === 0}
      emptyMessage="No initiatives synced"
      searchPlaceholder="Filter initiatives..."
    >
      {(filter) => {
        const filtered = initiatives.filter((i) =>
          i.name.toLowerCase().includes(filter.toLowerCase())
        );

        if (filtered.length === 0) {
          return (
            <div className="px-3 py-3 text-xs text-muted-foreground text-center">
              No initiatives match &quot;{filter}&quot;
            </div>
          );
        }

        return filtered.map((initiative) => (
          <PickerItem
            key={initiative.linear_id}
            selected={value.includes(initiative.linear_id)}
            onToggle={() => toggle(initiative.linear_id)}
          >
            <span className="flex items-center gap-2 min-w-0">
              {initiative.data.color && (
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: initiative.data.color }}
                />
              )}
              <span className="truncate">{initiative.name}</span>
              {initiative.status && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {initiative.status}
                </span>
              )}
            </span>
          </PickerItem>
        ));
      }}
    </PickerShell>
  );
}
