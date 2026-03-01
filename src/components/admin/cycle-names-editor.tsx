"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Check, Loader2, X } from "lucide-react";

interface CycleRow {
  id: string;
  name: string | null;
  number: number;
  startsAt: string | null;
  endsAt: string | null;
  displayName?: string;
  team?: { name?: string };
}

interface CycleNamesEditorProps {
  hubId: string;
  cycles: CycleRow[];
}

function formatDateRange(startsAt: string | null, endsAt: string | null) {
  if (!startsAt && !endsAt) return null;

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  if (startsAt && endsAt) return `${fmt(startsAt)} – ${fmt(endsAt)}`;
  if (startsAt) return `From ${fmt(startsAt)}`;
  return `Until ${fmt(endsAt!)}`;
}

function cycleLabel(cycle: CycleRow) {
  return cycle.name || `Cycle ${cycle.number}`;
}

type SaveState = "idle" | "saving" | "saved";

export function CycleNamesEditor({ hubId, cycles }: CycleNamesEditorProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of cycles) {
      init[c.id] = c.displayName ?? "";
    }
    return init;
  });

  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});

  const save = useCallback(
    async (cycle: CycleRow) => {
      const displayName = values[cycle.id]?.trim() || null;

      // No change — skip
      if (displayName === (cycle.displayName ?? null)) return;

      setSaveStates((s) => ({ ...s, [cycle.id]: "saving" }));

      try {
        const res = await fetch(
          `/api/admin/hubs/${hubId}/cycles/${cycle.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ displayName }),
          }
        );
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Failed to save");
        }
        setSaveStates((s) => ({ ...s, [cycle.id]: "saved" }));
        toast.success(
          displayName
            ? `Display name set to "${displayName}"`
            : "Display name cleared"
        );
        // Reset saved indicator after a moment
        setTimeout(() => {
          setSaveStates((s) => ({ ...s, [cycle.id]: "idle" }));
        }, 2000);
      } catch (e) {
        setSaveStates((s) => ({ ...s, [cycle.id]: "idle" }));
        toast.error(e instanceof Error ? e.message : "Failed to save");
      }
    },
    [hubId, values]
  );

  const clear = useCallback(
    async (cycle: CycleRow) => {
      setValues((v) => ({ ...v, [cycle.id]: "" }));
      setSaveStates((s) => ({ ...s, [cycle.id]: "saving" }));

      try {
        const res = await fetch(
          `/api/admin/hubs/${hubId}/cycles/${cycle.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ displayName: null }),
          }
        );
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Failed to clear");
        }
        setSaveStates((s) => ({ ...s, [cycle.id]: "saved" }));
        toast.success("Display name cleared");
        setTimeout(() => {
          setSaveStates((s) => ({ ...s, [cycle.id]: "idle" }));
        }, 2000);
      } catch (e) {
        setSaveStates((s) => ({ ...s, [cycle.id]: "idle" }));
        toast.error(e instanceof Error ? e.message : "Failed to clear");
      }
    },
    [hubId]
  );

  if (cycles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No cycles found for this hub&apos;s teams.
      </p>
    );
  }

  // Group by team name
  const teamNames = Array.from(
    new Set(cycles.map((c) => c.team?.name ?? "Unknown Team"))
  );
  const hasMultipleTeams = teamNames.length > 1;

  const grouped: Record<string, CycleRow[]> = {};
  for (const c of cycles) {
    const key = c.team?.name ?? "Unknown Team";
    (grouped[key] ??= []).push(c);
  }

  return (
    <div className="space-y-4">
      {teamNames.map((teamName) => (
        <div key={teamName}>
          {hasMultipleTeams && (
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              {teamName}
            </h4>
          )}
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            {grouped[teamName].map((cycle, i) => {
              const state = saveStates[cycle.id] ?? "idle";
              const value = values[cycle.id] ?? "";
              const hasOverride = !!cycle.displayName;
              const isDirty = value.trim() !== (cycle.displayName ?? "");

              return (
                <div
                  key={cycle.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5",
                    i < grouped[teamName].length - 1 &&
                      "border-b border-border"
                  )}
                >
                  {/* Cycle info */}
                  <div className="shrink-0 min-w-[140px]">
                    <span className="text-sm font-medium">
                      {cycleLabel(cycle)}
                    </span>
                    {(cycle.startsAt || cycle.endsAt) && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatDateRange(cycle.startsAt, cycle.endsAt)}
                      </p>
                    )}
                  </div>

                  {/* Display name input */}
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={value}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          [cycle.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && isDirty) save(cycle);
                      }}
                      placeholder="Display name override..."
                      className="flex-1 px-2.5 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent placeholder:text-muted-foreground/50"
                    />

                    {/* Save button */}
                    {state === "saving" ? (
                      <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
                    ) : state === "saved" ? (
                      <Check className="w-4 h-4 text-green-500 shrink-0" />
                    ) : isDirty ? (
                      <button
                        onClick={() => save(cycle)}
                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
                      >
                        Save
                      </button>
                    ) : hasOverride ? (
                      <button
                        onClick={() => clear(cycle)}
                        className="p-1 text-muted-foreground hover:text-destructive rounded-md transition-colors shrink-0"
                        title="Clear display name"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
