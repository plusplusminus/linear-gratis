"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  GanttChart,
  LayoutGrid,
  ListOrdered,
  CircleDot,
  SignalHigh,
  Tag,
  Filter,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { captureEvent } from "@/lib/posthog-client";
import { POSTHOG_EVENTS } from "@/lib/posthog-events";
import { CheckboxFilterDropdown } from "./filter-dropdown";
import { RoadmapTimeline } from "./roadmap-timeline";
import { RoadmapBoard } from "./roadmap-board";
import { RankingView } from "./ranking-view";

type Project = {
  id: string;
  name: string;
  color?: string;
  progress: number;
  startDate?: string;
  priority: number;
  priorityLabel: string;
  labels: Array<{ id: string; name: string; color: string }>;
  status: { name: string; color: string; type: string };
  targetDate?: string;
  teams: Array<{ id: string }>;
  milestones: Array<{
    id: string;
    name: string;
    targetDate?: string;
  }>;
};

type RoadmapViewMode = "timeline" | "board" | "priority";
type BoardGroupBy = "status" | "priority" | "label";

const PRIORITY_LABELS: Record<number, string> = {
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
  0: "No Priority",
};

export function RoadmapView({ projects }: { projects: Project[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [viewMode, setViewMode] = useState<RoadmapViewMode>(
    () => {
      const v = searchParams.get("roadmapView");
      if (v === "timeline" || v === "board" || v === "priority") return v;
      return "timeline";
    }
  );

  const [boardGroupBy, setBoardGroupBy] = useState<BoardGroupBy>(
    () => {
      const g = searchParams.get("roadmapGroup");
      if (g === "status" || g === "priority" || g === "label") return g;
      return "status";
    }
  );

  // Parse filters from URL
  const [statusFilter, setStatusFilter] = useState<string[]>(
    () => searchParams.get("rs")?.split(",").filter(Boolean) ?? []
  );
  const [priorityFilter, setPriorityFilter] = useState<string[]>(
    () => searchParams.get("rp")?.split(",").filter(Boolean) ?? []
  );
  const [labelFilter, setLabelFilter] = useState<string[]>(
    () => searchParams.get("rl")?.split(",").filter(Boolean) ?? []
  );

  // Track initial roadmap load only — view mode changes are navigation, not distinct views
  useEffect(() => {
    captureEvent(POSTHOG_EVENTS.roadmap_viewed, { viewType: viewMode });
  }, []); // eslint-disable-next-line react-hooks/exhaustive-deps

  function updateUrl(
    view: RoadmapViewMode,
    group: BoardGroupBy,
    rs: string[],
    rp: string[],
    rl: string[],
  ) {
    const params = new URLSearchParams(searchParams.toString());
    // Preserve tab
    const newParams = new URLSearchParams();
    const tab = params.get("tab");
    if (tab) newParams.set("tab", tab);
    if (view !== "timeline") newParams.set("roadmapView", view);
    if (view === "board" && group !== "status") newParams.set("roadmapGroup", group);
    if (rs.length > 0) newParams.set("rs", rs.join(","));
    if (rp.length > 0) newParams.set("rp", rp.join(","));
    if (rl.length > 0) newParams.set("rl", rl.join(","));
    const qs = newParams.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  function changeView(v: RoadmapViewMode) {
    setViewMode(v);
    updateUrl(v, boardGroupBy, statusFilter, priorityFilter, labelFilter);
  }

  function changeGroupBy(g: BoardGroupBy) {
    setBoardGroupBy(g);
    updateUrl(viewMode, g, statusFilter, priorityFilter, labelFilter);
  }

  function changeStatusFilter(next: string[]) {
    setStatusFilter(next);
    updateUrl(viewMode, boardGroupBy, next, priorityFilter, labelFilter);
  }

  function changePriorityFilter(next: string[]) {
    setPriorityFilter(next);
    updateUrl(viewMode, boardGroupBy, statusFilter, next, labelFilter);
  }

  function changeLabelFilter(next: string[]) {
    setLabelFilter(next);
    updateUrl(viewMode, boardGroupBy, statusFilter, priorityFilter, next);
  }

  // Derive available filter options from projects
  const { statusOptions, priorityOptions, labelOptions } = useMemo(() => {
    const statuses = new Map<string, { name: string; color: string }>();
    const priorities = new Map<number, string>();
    const labels = new Map<string, { id: string; name: string; color: string }>();

    for (const p of projects) {
      statuses.set(p.status.name, { name: p.status.name, color: p.status.color });
      priorities.set(p.priority, p.priorityLabel || PRIORITY_LABELS[p.priority] || "No Priority");
      for (const l of p.labels) {
        labels.set(l.id, l);
      }
    }

    return {
      statusOptions: Array.from(statuses.entries()).map(([id, s]) => ({ id, name: s.name, color: s.color })),
      priorityOptions: [1, 2, 3, 4, 0]
        .filter((p) => priorities.has(p))
        .map((p) => ({ id: String(p), name: priorities.get(p)! })),
      labelOptions: Array.from(labels.values()),
    };
  }, [projects]);

  // Apply filters
  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter.length > 0 && !statusFilter.includes(p.status.name)) return false;
      if (priorityFilter.length > 0 && !priorityFilter.includes(String(p.priority))) return false;
      if (labelFilter.length > 0 && !p.labels.some((l) => labelFilter.includes(l.id))) return false;
      return true;
    });
  }, [projects, statusFilter, priorityFilter, labelFilter]);

  const hasActiveFilters = statusFilter.length > 0 || priorityFilter.length > 0 || labelFilter.length > 0;
  const activeFilterCount = statusFilter.length + priorityFilter.length + labelFilter.length;
  const [showFilters, setShowFilters] = useState(hasActiveFilters);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div className="px-6 py-2 border-b border-border flex items-center gap-2 shrink-0">
        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors",
            showFilters || activeFilterCount > 0
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          Filter
          {activeFilterCount > 0 && (
            <span className="ml-0.5 px-1 py-0 rounded bg-primary text-primary-foreground text-[10px]">
              {activeFilterCount}
            </span>
          )}
        </button>

        {hasActiveFilters && (
          <button
            onClick={() => {
              changeStatusFilter([]);
              changePriorityFilter([]);
              changeLabelFilter([]);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}

        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex items-center border border-border rounded-md overflow-hidden">
          <button
            onClick={() => changeView("timeline")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-xs transition-colors",
              viewMode === "timeline"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <GanttChart className="w-3.5 h-3.5" />
            Timeline
          </button>
          <button
            onClick={() => changeView("board")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-xs transition-colors",
              viewMode === "board"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Board
          </button>
          <button
            onClick={() => changeView("priority")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-xs transition-colors",
              viewMode === "priority"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            Priority
          </button>
        </div>

        {/* Board group by selector */}
        {viewMode === "board" && (
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button
              onClick={() => changeGroupBy("status")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-xs transition-colors",
                boardGroupBy === "status"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Group by status"
            >
              <CircleDot className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => changeGroupBy("priority")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-xs transition-colors",
                boardGroupBy === "priority"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Group by priority"
            >
              <SignalHigh className="w-3.5 h-3.5" />
            </button>
            {labelOptions.length > 0 && (
              <button
                onClick={() => changeGroupBy("label")}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs transition-colors",
                  boardGroupBy === "label"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Group by label"
              >
                <Tag className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filter chips */}
      {showFilters && (
        <div className="px-6 py-2 border-b border-border flex flex-wrap gap-3 shrink-0">
          <CheckboxFilterDropdown
            items={statusOptions}
            selected={statusFilter}
            onChange={changeStatusFilter}
            label="Status"
            icon={<CircleDot className="w-3 h-3" />}
          />
          {priorityOptions.length > 0 && (
            <CheckboxFilterDropdown
              items={priorityOptions}
              selected={priorityFilter}
              onChange={changePriorityFilter}
              label="Priority"
              icon={<SignalHigh className="w-3 h-3" />}
            />
          )}
          {labelOptions.length > 0 && (
            <CheckboxFilterDropdown
              items={labelOptions}
              selected={labelFilter}
              onChange={changeLabelFilter}
              label="Label"
              icon={<Tag className="w-3 h-3" />}
            />
          )}
        </div>
      )}

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters
              ? "No projects match the current filters"
              : "No projects to display"}
          </p>
        </div>
      ) : viewMode === "priority" ? (
        <RankingView projects={filtered} />
      ) : viewMode === "timeline" ? (
        <div className="flex-1 overflow-auto p-6">
          <RoadmapTimeline projects={filtered} />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
          <RoadmapBoard projects={filtered} groupBy={boardGroupBy} />
        </div>
      )}
    </div>
  );
}
