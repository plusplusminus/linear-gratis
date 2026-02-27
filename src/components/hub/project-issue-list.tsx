"use client";

import { useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDot,
  CircleCheck,
  CircleX,
  CircleDashed,
  SignalHigh,
  SignalMedium,
  SignalLow,
  Signal,
  AlertTriangle,
  Calendar,
  Filter,
  X,
  List,
  Columns3,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanInteract } from "@/hooks/use-can-interact";
import { IssueDetailPanel } from "./issue-detail-panel";
import { HubKanban } from "./hub-kanban";

type Issue = {
  id: string;
  identifier: string;
  title: string;
  priority: number;
  priorityLabel: string;
  state: { id: string; name: string; color: string; type: string };
  labels: Array<{ id: string; name: string; color: string }>;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
};

type FilterState = {
  search: string;
  statuses: string[];
  priorities: number[];
  labelIds: string[];
};

type ViewMode = "list" | "kanban";
type SortField = "priority" | "dueDate" | "createdAt";
type SortDir = "asc" | "desc";

// Status type ordering for grouping
const STATUS_ORDER: Record<string, number> = {
  backlog: 0,
  unstarted: 1,
  started: 2,
  completed: 3,
  cancelled: 4,
};

export function ProjectIssueList({
  issues,
  states,
  labels,
  hubId,
}: {
  issues: Issue[];
  states: Array<{ id: string; name: string; color: string; type: string }>;
  labels: Array<{ id: string; name: string; color: string }>;
  hubSlug: string;
  teamKey: string;
  projectId: string;
  hubId: string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isViewOnly = !useCanInteract();

  // Parse filters from URL
  const [filters, setFilters] = useState<FilterState>(() => ({
    search: searchParams.get("q") ?? "",
    statuses: searchParams.getAll("status"),
    priorities: searchParams.getAll("priority").map(Number).filter((n) => !isNaN(n)),
    labelIds: searchParams.getAll("label"),
  }));

  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (searchParams.get("view") as ViewMode) || "list"
  );

  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({
    field: "priority",
    dir: "asc",
  });

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(
    filters.statuses.length > 0 ||
      filters.priorities.length > 0 ||
      filters.labelIds.length > 0
  );
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // Update URL params when filters/view change
  function updateUrl(next: FilterState, view: ViewMode) {
    const params = new URLSearchParams();
    if (next.search) params.set("q", next.search);
    next.statuses.forEach((s) => params.append("status", s));
    next.priorities.forEach((p) => params.append("priority", String(p)));
    next.labelIds.forEach((l) => params.append("label", l));
    if (view !== "list") params.set("view", view);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  function updateFilters(next: FilterState) {
    setFilters(next);
    updateUrl(next, viewMode);
  }

  function changeView(view: ViewMode) {
    setViewMode(view);
    updateUrl(filters, view);
  }

  // Filter issues
  const filtered = useMemo(() => {
    return issues.filter((issue) => {
      // Text search
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !issue.title.toLowerCase().includes(q) &&
          !issue.identifier.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (
        filters.statuses.length > 0 &&
        !filters.statuses.includes(issue.state.name)
      )
        return false;
      if (
        filters.priorities.length > 0 &&
        !filters.priorities.includes(issue.priority)
      )
        return false;
      if (
        filters.labelIds.length > 0 &&
        !issue.labels.some((l) => filters.labelIds.includes(l.id))
      )
        return false;
      return true;
    });
  }, [issues, filters]);

  // Sort issues within groups
  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sort.field) {
        case "priority":
          cmp = a.priority - b.priority;
          break;
        case "dueDate": {
          const da = a.dueDate ?? "9999";
          const db = b.dueDate ?? "9999";
          cmp = da.localeCompare(db);
          break;
        }
        case "createdAt":
          cmp = a.createdAt.localeCompare(b.createdAt);
          break;
      }
      return sort.dir === "desc" ? -cmp : cmp;
    });
    return copy;
  }, [filtered, sort]);

  // Group by status type (for list view)
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { state: { name: string; color: string; type: string }; issues: Issue[] }
    >();

    for (const issue of sorted) {
      const key = issue.state.name;
      if (!map.has(key)) {
        map.set(key, { state: issue.state, issues: [] });
      }
      map.get(key)!.issues.push(issue);
    }

    return Array.from(map.entries()).sort(([, a], [, b]) => {
      const oa = STATUS_ORDER[a.state.type] ?? 1;
      const ob = STATUS_ORDER[b.state.type] ?? 1;
      return oa - ob;
    });
  }, [sorted]);

  const hasActiveFilters =
    filters.search.length > 0 ||
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    filters.labelIds.length > 0;

  const activeFilterCount =
    filters.statuses.length + filters.priorities.length + filters.labelIds.length;

  function toggleGroup(name: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function toggleSort(field: SortField) {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" }
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar: search, filters, view toggle, sort */}
      <div className="px-6 py-2 border-b border-border flex items-center gap-2 shrink-0">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search issues..."
            value={filters.search}
            onChange={(e) => updateFilters({ ...filters, search: e.target.value })}
            className="pl-7 pr-2 py-1 w-40 rounded-md border border-border bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

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
            onClick={() =>
              updateFilters({ search: "", statuses: [], priorities: [], labelIds: [] })
            }
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
            onClick={() => changeView("list")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-xs transition-colors",
              viewMode === "list"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="w-3.5 h-3.5" />
            List
          </button>
          <button
            onClick={() => changeView("kanban")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-xs transition-colors",
              viewMode === "kanban"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Columns3 className="w-3.5 h-3.5" />
            Board
          </button>
        </div>

        {/* Sort controls (list view only) */}
        {viewMode === "list" && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground mr-1">Sort:</span>
            {(["priority", "dueDate", "createdAt"] as SortField[]).map((field) => (
              <button
                key={field}
                onClick={() => toggleSort(field)}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] transition-colors",
                  sort.field === field
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {field === "priority"
                  ? "Priority"
                  : field === "dueDate"
                    ? "Due"
                    : "Created"}
                {sort.field === field && (sort.dir === "asc" ? " \u2191" : " \u2193")}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter chips */}
      {showFilters && (
        <div className="px-6 py-2 border-b border-border flex flex-wrap gap-3 shrink-0">
          {/* Status filter */}
          <FilterGroup label="Status">
            {states.map((s) => (
              <FilterChip
                key={s.name}
                label={s.name}
                color={s.color}
                active={filters.statuses.includes(s.name)}
                onClick={() => {
                  const next = filters.statuses.includes(s.name)
                    ? filters.statuses.filter((x) => x !== s.name)
                    : [...filters.statuses, s.name];
                  updateFilters({ ...filters, statuses: next });
                }}
              />
            ))}
          </FilterGroup>

          {/* Priority filter */}
          <FilterGroup label="Priority">
            {[1, 2, 3, 4, 0].map((p) => (
              <FilterChip
                key={p}
                label={priorityLabel(p)}
                active={filters.priorities.includes(p)}
                onClick={() => {
                  const next = filters.priorities.includes(p)
                    ? filters.priorities.filter((x) => x !== p)
                    : [...filters.priorities, p];
                  updateFilters({ ...filters, priorities: next });
                }}
              />
            ))}
          </FilterGroup>

          {/* Label filter */}
          {labels.length > 0 && (
            <FilterGroup label="Label">
              {labels.map((l) => (
                <FilterChip
                  key={l.id}
                  label={l.name}
                  color={l.color}
                  active={filters.labelIds.includes(l.id)}
                  onClick={() => {
                    const next = filters.labelIds.includes(l.id)
                      ? filters.labelIds.filter((x) => x !== l.id)
                      : [...filters.labelIds, l.id];
                    updateFilters({ ...filters, labelIds: next });
                  }}
                />
              ))}
            </FilterGroup>
          )}
        </div>
      )}

      {/* Content area */}
      {viewMode === "kanban" ? (
        <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
          <HubKanban issues={sorted} onIssueClick={setSelectedIssueId} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {groups.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "No issues match the current filters"
                  : "No issues in this project"}
              </p>
            </div>
          ) : (
            groups.map(([groupName, group]) => {
              const isCollapsed = collapsedGroups.has(groupName);
              return (
                <div key={groupName}>
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(groupName)}
                    className="w-full flex items-center gap-2 px-6 py-2 text-xs font-medium hover:bg-accent/30 transition-colors sticky top-0 bg-background z-10 border-b border-border"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <StatusIcon type={group.state.type} color={group.state.color} />
                    <span>{groupName}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {group.issues.length}
                    </span>
                  </button>

                  {/* Issue rows */}
                  {!isCollapsed &&
                    group.issues.map((issue) => (
                      <IssueRow
                        key={issue.id}
                        issue={issue}
                        selected={selectedIssueId === issue.id}
                        onClick={() => setSelectedIssueId(issue.id)}
                      />
                    ))}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Issue detail panel */}
      <IssueDetailPanel
        issueId={selectedIssueId}
        hubId={hubId}
        isViewOnly={isViewOnly}
        onClose={() => setSelectedIssueId(null)}
      />
    </div>
  );
}

// -- Sub-components ──────────────────────────────────────────────────────────

function IssueRow({
  issue,
  selected,
  onClick,
}: {
  issue: Issue;
  selected: boolean;
  onClick: () => void;
}) {
  const isOverdue =
    issue.dueDate && new Date(issue.dueDate) < new Date();
  const isDueSoon =
    issue.dueDate &&
    !isOverdue &&
    new Date(issue.dueDate).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-6 py-2 text-left hover:bg-accent/30 transition-colors border-b border-border/50",
        selected && "bg-accent/50"
      )}
    >
      <StatusIcon type={issue.state.type} color={issue.state.color} />
      <span className="text-[11px] font-mono text-muted-foreground shrink-0 w-16">
        {issue.identifier}
      </span>
      <span className="text-sm truncate flex-1 min-w-0">{issue.title}</span>
      {issue.labels.length > 0 && (
        <div className="flex items-center gap-1 shrink-0">
          {issue.labels.slice(0, 3).map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white/90"
              style={{ backgroundColor: label.color || "var(--muted)" }}
            >
              {label.name}
            </span>
          ))}
          {issue.labels.length > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{issue.labels.length - 3}
            </span>
          )}
        </div>
      )}
      <PriorityIcon priority={issue.priority} />
      {issue.dueDate && (
        <span
          className={cn(
            "flex items-center gap-1 text-[10px] tabular-nums shrink-0",
            isOverdue
              ? "text-destructive"
              : isDueSoon
                ? "text-yellow-500"
                : "text-muted-foreground"
          )}
        >
          <Calendar className="w-3 h-3" />
          {formatShortDate(issue.dueDate)}
        </span>
      )}
    </button>
  );
}

function StatusIcon({ type, color }: { type: string; color: string }) {
  const style = { color: color || "var(--muted-foreground)" };
  const cls = "w-3.5 h-3.5 shrink-0";
  switch (type) {
    case "backlog":
      return <CircleDashed className={cls} style={style} />;
    case "unstarted":
      return <Circle className={cls} style={style} />;
    case "started":
      return <CircleDot className={cls} style={style} />;
    case "completed":
      return <CircleCheck className={cls} style={style} />;
    case "cancelled":
      return <CircleX className={cls} style={style} />;
    default:
      return <Circle className={cls} style={style} />;
  }
}

function PriorityIcon({ priority }: { priority: number }) {
  const cls = "w-3.5 h-3.5 shrink-0";
  switch (priority) {
    case 1:
      return <AlertTriangle className={cn(cls, "text-orange-500")} />;
    case 2:
      return <SignalHigh className={cn(cls, "text-orange-400")} />;
    case 3:
      return <SignalMedium className={cn(cls, "text-yellow-500")} />;
    case 4:
      return <SignalLow className={cn(cls, "text-blue-400")} />;
    default:
      return <Signal className={cn(cls, "text-muted-foreground/40")} />;
  }
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground font-medium">
        {label}:
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function FilterChip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors",
        active
          ? "bg-accent text-foreground ring-1 ring-ring"
          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {color && (
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
    </button>
  );
}

function priorityLabel(p: number): string {
  switch (p) {
    case 1: return "Urgent";
    case 2: return "High";
    case 3: return "Medium";
    case 4: return "Low";
    default: return "None";
  }
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
