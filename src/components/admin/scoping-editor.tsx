"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TeamPicker, ProjectPicker, LabelPicker, InitiativePicker } from "./pickers";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";

interface TeamMapping {
  id: string;
  linear_team_id: string;
  linear_team_name: string | null;
  visible_project_ids: string[];
  visible_initiative_ids: string[];
  visible_label_ids: string[];
  is_active: boolean;
}

interface ScopingEditorProps {
  hubId: string;
  mappings: TeamMapping[];
}

export function ScopingEditor({ hubId, mappings }: ScopingEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expandedTeam, setExpandedTeam] = useState<string | null>(
    mappings[0]?.id ?? null
  );
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [addingTeamIds, setAddingTeamIds] = useState<string[]>([]);

  // IDs already mapped (for excluding from add picker)
  const mappedTeamIds = mappings.map((m) => m.linear_team_id);

  function saveMapping(mapping: TeamMapping, updates: Partial<Pick<TeamMapping, "visible_project_ids" | "visible_initiative_ids" | "visible_label_ids">>) {
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/hubs/${hubId}/teams/${mapping.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          }
        );
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Failed to save");
        }
        toast.success(`${mapping.linear_team_name ?? "Team"} scoping saved`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  function removeMapping(mapping: TeamMapping) {
    if (!confirm(`Remove ${mapping.linear_team_name ?? "this team"} from the hub?`)) return;

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/hubs/${hubId}/teams/${mapping.id}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Failed to remove");
        }
        toast.success(`${mapping.linear_team_name ?? "Team"} removed`);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to remove");
      }
    });
  }

  function addTeams() {
    startTransition(async () => {
      let added = 0;
      for (const teamId of addingTeamIds) {
        try {
          const res = await fetch(`/api/admin/hubs/${hubId}/teams`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ linear_team_id: teamId }),
          });
          if (res.ok) added++;
        } catch {
          // continue adding others
        }
      }
      if (added > 0) {
        toast.success(`Added ${added} team${added !== 1 ? "s" : ""}`);
        setAddingTeamIds([]);
        setShowAddTeam(false);
        router.refresh();
      } else {
        toast.error("Failed to add teams");
      }
    });
  }

  return (
    <div className="space-y-4">
      {mappings.length === 0 && !showAddTeam && (
        <div className="border border-border rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            No teams mapped to this hub yet.
          </p>
          <button
            onClick={() => setShowAddTeam(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Team
          </button>
        </div>
      )}

      {/* Existing mappings */}
      {mappings.map((mapping) => {
        const isExpanded = expandedTeam === mapping.id;
        return (
          <MappingCard
            key={mapping.id}
            mapping={mapping}
            expanded={isExpanded}
            onToggle={() =>
              setExpandedTeam(isExpanded ? null : mapping.id)
            }
            onSave={(updates) => saveMapping(mapping, updates)}
            onRemove={() => removeMapping(mapping)}
            isPending={isPending}
          />
        );
      })}

      {/* Add team section */}
      {mappings.length > 0 && !showAddTeam && (
        <button
          onClick={() => setShowAddTeam(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add team
        </button>
      )}

      {showAddTeam && (
        <div className="border border-border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium">Add teams</p>
          <TeamPicker value={addingTeamIds} onChange={setAddingTeamIds} />
          <div className="flex items-center gap-2">
            <button
              onClick={addTeams}
              disabled={addingTeamIds.length === 0 || isPending}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                addingTeamIds.length > 0
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isPending ? "Adding..." : `Add ${addingTeamIds.length || ""} team${addingTeamIds.length !== 1 ? "s" : ""}`}
            </button>
            <button
              onClick={() => {
                setShowAddTeam(false);
                setAddingTeamIds([]);
              }}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MappingCard({
  mapping,
  expanded,
  onToggle,
  onSave,
  onRemove,
  isPending,
}: {
  mapping: TeamMapping;
  expanded: boolean;
  onToggle: () => void;
  onSave: (updates: Partial<Pick<TeamMapping, "visible_project_ids" | "visible_initiative_ids" | "visible_label_ids">>) => void;
  onRemove: () => void;
  isPending: boolean;
}) {
  const [projectIds, setProjectIds] = useState(mapping.visible_project_ids);
  const [initiativeIds, setInitiativeIds] = useState(mapping.visible_initiative_ids);
  const [labelIds, setLabelIds] = useState(mapping.visible_label_ids);

  const hasChanges =
    JSON.stringify(projectIds) !== JSON.stringify(mapping.visible_project_ids) ||
    JSON.stringify(initiativeIds) !== JSON.stringify(mapping.visible_initiative_ids) ||
    JSON.stringify(labelIds) !== JSON.stringify(mapping.visible_label_ids);

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          {mapping.linear_team_name ?? mapping.linear_team_id}
        </button>
        <div className="flex items-center gap-2">
          <ScopingBadges mapping={mapping} />
          <button
            onClick={onRemove}
            disabled={isPending}
            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
            title="Remove team"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          <ProjectPicker
            teamId={mapping.linear_team_id}
            value={projectIds}
            onChange={setProjectIds}
          />
          <LabelPicker
            teamId={mapping.linear_team_id}
            value={labelIds}
            onChange={setLabelIds}
          />
          <InitiativePicker
            value={initiativeIds}
            onChange={setInitiativeIds}
          />

          {hasChanges && (
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() =>
                  onSave({
                    visible_project_ids: projectIds,
                    visible_initiative_ids: initiativeIds,
                    visible_label_ids: labelIds,
                  })
                }
                disabled={isPending}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save Scoping"}
              </button>
              <button
                onClick={() => {
                  setProjectIds(mapping.visible_project_ids);
                  setInitiativeIds(mapping.visible_initiative_ids);
                  setLabelIds(mapping.visible_label_ids);
                }}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScopingBadges({ mapping }: { mapping: TeamMapping }) {
  const p = mapping.visible_project_ids.length;
  const l = mapping.visible_label_ids.length;
  const i = mapping.visible_initiative_ids.length;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
        {p === 0 ? "All" : p} proj
      </span>
      <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
        {l === 0 ? "All" : l} labels
      </span>
      <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
        {i === 0 ? "All" : i} init
      </span>
    </div>
  );
}
