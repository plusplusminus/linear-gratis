"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, CircleDot, Calendar, Sparkles, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHub } from "@/contexts/hub-context";
import { useCanInteract } from "@/hooks/use-can-interact";
import { captureEvent } from "@/lib/posthog-client";
import { POSTHOG_EVENTS } from "@/lib/posthog-events";

type Project = {
  id: string;
  name: string;
  color?: string;
  progress: number;
  priority: number;
  priorityLabel: string;
  labels: Array<{ id: string; name: string; color: string }>;
  status: { name: string; color: string; type: string };
  targetDate?: string;
};

type UserRanking = { projectLinearId: string; rank: number };

export function RankingView({ projects }: { projects: Project[] }) {
  const { hubId } = useHub();
  const canInteract = useCanInteract();
  const [ranked, setRanked] = useState<Project[]>([]);
  const [unranked, setUnranked] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBanner, setShowBanner] = useState(false);
  const savingRef = useRef(false);

  // Track view
  useEffect(() => {
    try {
      captureEvent(POSTHOG_EVENTS.ranking_viewed, { hubId });
    } catch { /* best-effort */ }
  }, [hubId]);

  // Load rankings
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/hubs/${hubId}/rankings`);
        if (!res.ok) {
          setRanked([...projects].sort((a, b) => a.priority - b.priority));
          setIsLoading(false);
          return;
        }
        const data = (await res.json()) as {
          userRanking: UserRanking[];
        };

        if (data.userRanking.length === 0) {
          // Never ranked — show default order, don't save
          setRanked([]);
          setUnranked([...projects].sort((a, b) => a.priority - b.priority));
          setShowBanner(true);
          setIsLoading(false);
          return;
        }

        // Rebuild ordered list from ranking data
        const projectMap = new Map(projects.map((p) => [p.id, p]));
        const rankedIds = new Set(data.userRanking.map((r) => r.projectLinearId));

        const orderedRanked: Project[] = [];
        for (const r of data.userRanking) {
          const p = projectMap.get(r.projectLinearId);
          if (p) orderedRanked.push(p);
        }

        // Projects not yet ranked (new additions)
        const newProjects = projects.filter((p) => !rankedIds.has(p.id));

        setRanked(orderedRanked);
        setUnranked(newProjects);
      } catch {
        setRanked([...projects].sort((a, b) => a.priority - b.priority));
      }
      setIsLoading(false);
    }
    load();
  }, [hubId, projects]);

  const saveRanking = useCallback(
    async (items: Project[]) => {
      if (savingRef.current) return;
      savingRef.current = true;
      try {
        const res = await fetch(`/api/hubs/${hubId}/rankings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ranking: items.map((p) => p.id) }),
        });
        if (res.ok) {
          const data = (await res.json()) as { changedCount: number };
          try {
            captureEvent(POSTHOG_EVENTS.ranking_updated, {
              hubId,
              projectCount: items.length,
              changedCount: data.changedCount,
            });
          } catch { /* best-effort */ }
        }
      } catch {
        // Silent — optimistic UI already updated
      } finally {
        savingRef.current = false;
      }
    },
    [hubId]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Check if dragging an unranked item
    const fromUnranked = unranked.find((p) => p.id === active.id);

    if (fromUnranked) {
      // Move from unranked to ranked
      const newUnranked = unranked.filter((p) => p.id !== active.id);
      const overIndex = ranked.findIndex((p) => p.id === over.id);
      const newRanked = [...ranked];
      if (overIndex >= 0) {
        newRanked.splice(overIndex, 0, fromUnranked);
      } else {
        newRanked.push(fromUnranked);
      }
      setUnranked(newUnranked);
      setRanked(newRanked);
      saveRanking([...newRanked, ...newUnranked]);
      setShowBanner(false);
      return;
    }

    // Reorder within ranked list
    const oldIndex = ranked.findIndex((p) => p.id === active.id);
    const newIndex = ranked.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(ranked, oldIndex, newIndex);
    setRanked(reordered);
    saveRanking([...reordered, ...unranked]);
    setShowBanner(false);
  }

  if (isLoading) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-muted-foreground">Loading rankings...</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-muted-foreground">No projects to rank</p>
      </div>
    );
  }

  if (projects.length === 1) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Priority ranking is available when there are 2 or more projects
        </p>
      </div>
    );
  }

  const allItems = [...ranked, ...unranked];

  return (
    <div className="flex-1 overflow-auto p-6 max-w-2xl mx-auto">
      {showBanner && canInteract && (
        <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-md bg-accent/50 text-sm text-muted-foreground">
          <Info className="w-4 h-4 shrink-0" />
          <span>Drag projects to show your team what matters most</span>
          <button
            onClick={() => setShowBanner(false)}
            className="ml-auto text-xs hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={allItems.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
          disabled={!canInteract}
        >
          <div className="space-y-1">
            {ranked.map((project, index) => (
              <SortableProjectRow
                key={project.id}
                project={project}
                rank={index + 1}
                canDrag={canInteract}
                isNew={false}
              />
            ))}
            {unranked.length > 0 && ranked.length > 0 && (
              <div className="py-2 px-2">
                <div className="border-t border-dashed border-border" />
                <p className="text-[10px] text-muted-foreground mt-1.5 uppercase tracking-wider">
                  New — drag to rank
                </p>
              </div>
            )}
            {unranked.map((project) => (
              <SortableProjectRow
                key={project.id}
                project={project}
                rank={null}
                canDrag={canInteract}
                isNew={true}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableProjectRow({
  project,
  rank,
  canDrag,
  isNew,
}: {
  project: Project;
  rank: number | null;
  canDrag: boolean;
  isNew: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id, disabled: !canDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const color = project.color || project.status.color || "var(--primary)";
  const progressPct = Math.round(project.progress * 100);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md border bg-card transition-colors",
        isDragging
          ? "border-primary/50 shadow-md z-10 opacity-90"
          : "border-border/40 hover:border-border/60",
        isNew && "opacity-70"
      )}
    >
      {/* Drag handle */}
      {canDrag && (
        <button
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}

      {/* Rank number */}
      <span
        className={cn(
          "w-6 text-center text-xs font-medium tabular-nums shrink-0",
          rank ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {rank ?? (
          <Sparkles className="w-3.5 h-3.5 mx-auto text-amber-500" />
        )}
      </span>

      {/* Color dot */}
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />

      {/* Name */}
      <span className="text-sm font-medium text-foreground truncate flex-1">
        {project.name}
      </span>

      {/* Progress bar */}
      <div className="flex items-center gap-1.5 w-20 shrink-0">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${progressPct}%`,
              backgroundColor: color,
            }}
          />
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground w-7 text-right">
          {progressPct}%
        </span>
      </div>

      {/* Status badge */}
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted/50 text-muted-foreground shrink-0">
        <CircleDot
          className="w-2.5 h-2.5"
          style={{ color: project.status.color }}
        />
        {project.status.name}
      </span>

      {/* Target date */}
      {project.targetDate && (
        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
          <Calendar className="w-3 h-3" />
          {formatDate(project.targetDate)}
        </span>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}
