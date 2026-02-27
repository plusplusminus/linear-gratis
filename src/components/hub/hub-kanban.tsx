"use client";

import {
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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  project?: { id: string; name: string; color?: string };
};

const STATUS_ORDER: Record<string, number> = {
  triage: 0,
  backlog: 1,
  unstarted: 2,
  started: 3,
  completed: 4,
  cancelled: 5,
};

export function HubKanban({
  issues,
  onIssueClick,
}: {
  issues: Issue[];
  onIssueClick?: (issueId: string) => void;
}) {
  // Group by state
  const grouped = issues.reduce(
    (acc, issue) => {
      const key = issue.state.name;
      if (!acc[key]) {
        acc[key] = { state: issue.state, issues: [] };
      }
      acc[key].issues.push(issue);
      return acc;
    },
    {} as Record<string, { state: Issue["state"]; issues: Issue[] }>
  );

  // Sort columns by workflow order
  const columns = Object.entries(grouped).sort(([, a], [, b]) => {
    const oa = STATUS_ORDER[a.state.type] ?? 99;
    const ob = STATUS_ORDER[b.state.type] ?? 99;
    return oa - ob;
  });

  if (issues.length === 0) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-muted-foreground">No issues to display</p>
      </div>
    );
  }

  return (
    <div className="flex gap-1 overflow-x-auto pb-4 px-1">
      {columns.map(([name, column]) => (
        <div key={name} className="flex-shrink-0 w-80 sm:w-[356px]">
          {/* Column header */}
          <div className="flex items-center gap-2 p-3 mb-2">
            <StatusIcon type={column.state.type} color={column.state.color} />
            <span className="text-sm font-medium text-foreground tracking-tight">
              {name}
            </span>
            <span className="px-2 py-0.5 bg-muted/60 rounded-full text-xs font-medium text-muted-foreground">
              {column.issues.length}
            </span>
          </div>

          {/* Cards */}
          <div className="space-y-2 px-1">
            {column.issues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onClick={() => onIssueClick?.(issue.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function IssueCard({
  issue,
  onClick,
}: {
  issue: Issue;
  onClick: () => void;
}) {
  const isOverdue = issue.dueDate && new Date(issue.dueDate) < new Date();
  const isDueSoon =
    issue.dueDate &&
    !isOverdue &&
    new Date(issue.dueDate).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

  return (
    <button
      onClick={onClick}
      className="w-full bg-card border border-border/40 rounded-md hover:border-border/60 hover:shadow-sm transition-all duration-200 cursor-pointer text-left"
    >
      <div className="p-3">
        {/* Top row: identifier + status */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-mono text-muted-foreground/80 tracking-wider font-semibold">
            {issue.identifier}
          </span>
          <StatusIcon type={issue.state.type} color={issue.state.color} />
        </div>

        {/* Title */}
        <h4 className="text-sm font-medium text-foreground leading-tight tracking-tight line-clamp-2 mb-3">
          {issue.title}
        </h4>

        {/* Project badge */}
        {issue.project && (
          <div className="flex items-center gap-1 mb-2">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: issue.project.color || "var(--muted-foreground)" }}
            />
            <span className="text-[10px] text-muted-foreground truncate">
              {issue.project.name}
            </span>
          </div>
        )}

        {/* Bottom badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <PriorityBadge priority={issue.priority} />

          {issue.labels.map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted/50 text-muted-foreground"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: label.color }}
              />
              {label.name}
            </span>
          ))}

          {issue.dueDate && (
            <span
              className={cn(
                "flex items-center gap-1 text-[10px] tabular-nums",
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
        </div>
      </div>
    </button>
  );
}

function StatusIcon({ type, color }: { type: string; color: string }) {
  const style = { color: color || "var(--muted-foreground)" };
  const cls = "w-3.5 h-3.5 shrink-0";
  switch (type) {
    case "triage":
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

function PriorityBadge({ priority }: { priority: number }) {
  const cls = "w-3 h-3";
  let icon;
  switch (priority) {
    case 1:
      icon = <AlertTriangle className={cn(cls, "text-orange-500")} />;
      break;
    case 2:
      icon = <SignalHigh className={cn(cls, "text-orange-400")} />;
      break;
    case 3:
      icon = <SignalMedium className={cn(cls, "text-yellow-500")} />;
      break;
    case 4:
      icon = <SignalLow className={cn(cls, "text-blue-400")} />;
      break;
    default:
      icon = <Signal className={cn(cls, "text-muted-foreground/40")} />;
      break;
  }
  return (
    <span className="inline-flex items-center px-1 py-0.5 rounded bg-muted/50">
      {icon}
    </span>
  );
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
