"use client";

import { useFetch } from "@/hooks/use-fetch";
import { PickerShell, PickerItem } from "./picker-shell";

interface LinearLabel {
  id: string;
  name: string;
  color: string;
  parent?: { id: string; name: string } | null;
}

interface LabelPickerProps {
  teamId: string | null;
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  description?: string;
}

export function LabelPicker({ teamId, value, onChange, label = "Labels", description }: LabelPickerProps) {
  const { data, loading, error, refetch } = useFetch<LinearLabel[]>(
    teamId ? `/api/admin/linear/teams/${teamId}/labels` : null,
    { enabled: !!teamId }
  );

  const labels = data ?? [];

  function toggle(id: string) {
    onChange(
      value.includes(id) ? value.filter((v) => v !== id) : [...value, id]
    );
  }

  if (!teamId) {
    return (
      <div className="border border-border rounded-lg bg-card">
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <p className="text-xs font-medium text-foreground">{label}</p>
        </div>
        <div className="px-3 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            Select a team to see its labels
          </p>
        </div>
      </div>
    );
  }

  // Group labels: parent labels first, then children indented
  const parentLabels = labels.filter((l) => !l.parent);
  const childLabels = labels.filter((l) => l.parent);
  const grouped: Array<LinearLabel & { isChild: boolean }> = [];

  for (const parent of parentLabels) {
    grouped.push({ ...parent, isChild: false });
    const children = childLabels.filter((c) => c.parent?.id === parent.id);
    for (const child of children) {
      grouped.push({ ...child, isChild: true });
    }
  }

  // Add orphan children (parent not in current list)
  const groupedIds = new Set(grouped.map((g) => g.id));
  for (const child of childLabels) {
    if (!groupedIds.has(child.id)) {
      grouped.push({ ...child, isChild: true });
    }
  }

  return (
    <PickerShell
      label={label}
      description={description}
      loading={loading}
      error={error}
      onRetry={refetch}
      empty={labels.length === 0}
      emptyMessage="No labels found for this team"
      searchPlaceholder="Filter labels..."
    >
      {(filter) => {
        const filtered = grouped.filter((l) =>
          l.name.toLowerCase().includes(filter.toLowerCase())
        );

        if (filtered.length === 0) {
          return (
            <div className="px-3 py-3 text-xs text-muted-foreground text-center">
              No labels match &quot;{filter}&quot;
            </div>
          );
        }

        return filtered.map((label) => (
          <PickerItem
            key={label.id}
            selected={value.includes(label.id)}
            onToggle={() => toggle(label.id)}
            className={label.isChild ? "pl-7" : undefined}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                style={{ backgroundColor: label.color }}
              />
              <span className="truncate">{label.name}</span>
            </span>
          </PickerItem>
        ));
      }}
    </PickerShell>
  );
}
