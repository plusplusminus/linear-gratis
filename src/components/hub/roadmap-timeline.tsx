"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Calendar, FolderKanban } from "lucide-react";
import { HubVoteButton } from "./vote-button";

type Project = {
  id: string;
  name: string;
  color?: string;
  startDate?: string;
  targetDate?: string;
  progress: number;
  status: { name: string; color: string; type: string };
};

type VoteData = {
  counts: Record<string, number>;
  userVotes: string[];
};

const STATUS_COLORS: Record<string, string> = {
  planned: "var(--muted-foreground)",
  started: "#3b82f6",
  completed: "#22c55e",
  paused: "#eab308",
  cancelled: "#6b7280",
};

function getStatusColor(status: { color: string; type: string }): string {
  return status.color || STATUS_COLORS[status.type] || STATUS_COLORS.planned;
}

export function RoadmapTimeline({
  projects,
  hubSlug,
  hubId,
  teamKey,
}: {
  projects: Project[];
  hubSlug: string;
  hubId: string;
  teamKey: string;
}) {
  const [voteData, setVoteData] = useState<VoteData>({ counts: {}, userVotes: [] });

  const projectIds = useMemo(() => projects.map((p) => p.id), [projects]);

  // Fetch vote data on mount
  useEffect(() => {
    if (projectIds.length === 0) return;

    async function fetchVotes() {
      try {
        const res = await fetch(
          `/api/hubs/${hubId}/votes?issueIds=${projectIds.join(",")}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as VoteData;
        setVoteData(data);
      } catch {
        // Silently fail — votes are non-critical
      }
    }
    fetchVotes();
  }, [hubId, projectIds]);

  const getVoteCount = useCallback(
    (projectId: string) => voteData.counts[projectId] ?? 0,
    [voteData.counts]
  );

  const hasUserVoted = useCallback(
    (projectId: string) => voteData.userVotes.includes(projectId),
    [voteData.userVotes]
  );

  const { dated, undated } = useMemo(() => {
    const d: Project[] = [];
    const u: Project[] = [];
    for (const p of projects) {
      if (p.startDate || p.targetDate) d.push(p);
      else u.push(p);
    }
    return { dated: d, undated: u };
  }, [projects]);

  // Calculate time range
  const { months, startMs, endMs, totalMs } = useMemo(() => {
    if (dated.length === 0) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 3, 1);
      return {
        months: generateMonths(start, end),
        startMs: start.getTime(),
        endMs: end.getTime(),
        totalMs: end.getTime() - start.getTime(),
      };
    }

    let earliest = Infinity;
    let latest = -Infinity;
    for (const p of dated) {
      if (p.startDate) earliest = Math.min(earliest, new Date(p.startDate).getTime());
      if (p.targetDate) latest = Math.max(latest, new Date(p.targetDate).getTime());
      if (p.startDate && !p.targetDate) latest = Math.max(latest, new Date(p.startDate).getTime());
      if (p.targetDate && !p.startDate) earliest = Math.min(earliest, new Date(p.targetDate).getTime());
    }

    const start = new Date(earliest);
    start.setMonth(start.getMonth() - 1);
    start.setDate(1);
    const end = new Date(latest);
    end.setMonth(end.getMonth() + 2);
    end.setDate(1);

    return {
      months: generateMonths(start, end),
      startMs: start.getTime(),
      endMs: end.getTime(),
      totalMs: end.getTime() - start.getTime(),
    };
  }, [dated]);

  const todayMs = Date.now();
  const todayPct =
    totalMs > 0
      ? ((todayMs - startMs) / totalMs) * 100
      : 0;
  const showToday = todayPct >= 0 && todayPct <= 100;

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <FolderKanban className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No projects to show</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Desktop timeline */}
      <div className="hidden sm:block flex-1 overflow-x-auto overflow-y-auto px-6 pb-6">
        <div className="relative min-w-[600px]">
          {/* Month headers */}
          <div className="flex border-b border-border sticky top-0 bg-background z-10">
            {months.map((m) => (
              <div
                key={m.key}
                className="text-[10px] font-medium text-muted-foreground py-2 border-r border-border/50"
                style={{ width: `${m.widthPct}%` }}
              >
                <span className="px-2">{m.label}</span>
              </div>
            ))}
          </div>

          {/* Grid lines + today marker */}
          <div className="relative">
            {/* Grid lines */}
            <div className="absolute inset-0 flex pointer-events-none">
              {months.map((m) => (
                <div
                  key={m.key}
                  className="border-r border-border/30 h-full"
                  style={{ width: `${m.widthPct}%` }}
                />
              ))}
            </div>

            {/* Today line */}
            {showToday && (
              <div
                className="absolute top-0 bottom-0 w-px border-l border-dashed border-primary/50 z-10 pointer-events-none"
                style={{ left: `${todayPct}%` }}
              >
                <span className="absolute -top-5 -translate-x-1/2 text-[9px] text-primary font-medium">
                  Today
                </span>
              </div>
            )}

            {/* Project bars */}
            <div className="relative py-2 space-y-2">
              {dated.map((project) => {
                const pStart = project.startDate
                  ? new Date(project.startDate).getTime()
                  : project.targetDate
                    ? new Date(project.targetDate).getTime() - 30 * 24 * 60 * 60 * 1000
                    : startMs;
                const pEnd = project.targetDate
                  ? new Date(project.targetDate).getTime()
                  : project.startDate
                    ? new Date(project.startDate).getTime() + 30 * 24 * 60 * 60 * 1000
                    : endMs;

                const leftPct = totalMs > 0 ? ((pStart - startMs) / totalMs) * 100 : 0;
                const widthPct = totalMs > 0 ? ((pEnd - pStart) / totalMs) * 100 : 10;

                return (
                  <ProjectBar
                    key={project.id}
                    project={project}
                    leftPct={Math.max(0, leftPct)}
                    widthPct={Math.max(3, Math.min(100 - leftPct, widthPct))}
                    href={`/hub/${hubSlug}/${teamKey}/projects/${project.id}`}
                    hubId={hubId}
                    voteCount={getVoteCount(project.id)}
                    hasVoted={hasUserVoted(project.id)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile list fallback */}
      <div className="sm:hidden flex-1 overflow-y-auto px-6 pb-6 space-y-2">
        {dated.map((project) => (
          <ProjectListItem
            key={project.id}
            project={project}
            href={`/hub/${hubSlug}/${teamKey}/projects/${project.id}`}
            hubId={hubId}
            voteCount={getVoteCount(project.id)}
            hasVoted={hasUserVoted(project.id)}
          />
        ))}
      </div>

      {/* Undated projects */}
      {undated.length > 0 && (
        <div className="px-6 pb-6">
          <h3 className="text-xs font-medium text-muted-foreground mb-2">
            No dates set
          </h3>
          <div className="space-y-1.5">
            {undated.map((project) => (
              <ProjectListItem
                key={project.id}
                project={project}
                href={`/hub/${hubSlug}/${teamKey}/projects/${project.id}`}
                hubId={hubId}
                voteCount={getVoteCount(project.id)}
                hasVoted={hasUserVoted(project.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// -- Sub-components ──────────────────────────────────────────────────────────

function ProjectBar({
  project,
  leftPct,
  widthPct,
  href,
  hubId,
  voteCount,
  hasVoted,
}: {
  project: Project;
  leftPct: number;
  widthPct: number;
  href: string;
  hubId: string;
  voteCount: number;
  hasVoted: boolean;
}) {
  const color = project.color || getStatusColor(project.status);
  const progressPct = Math.round(project.progress * 100);

  return (
    <div className="flex items-center gap-1.5">
      <HubVoteButton
        hubId={hubId}
        issueLinearId={project.id}
        initialCount={voteCount}
        initialVoted={hasVoted}
      />
      <div className="relative h-8 flex-1" style={{ marginLeft: `${leftPct}%`, width: `${widthPct}%` }}>
        <Link
          href={href}
          className="block h-full rounded-md overflow-hidden group relative"
          style={{ backgroundColor: `${color}20`, borderLeft: `3px solid ${color}` }}
          title={`${project.name} — ${project.status.name} (${progressPct}%)`}
        >
          {/* Progress fill */}
          <div
            className="absolute inset-y-0 left-0 opacity-20"
            style={{ width: `${progressPct}%`, backgroundColor: color }}
          />
          {/* Text */}
          <div className="relative flex items-center justify-between h-full px-2 min-w-0">
            <span className="text-[11px] font-medium truncate group-hover:text-primary transition-colors">
              {project.name}
            </span>
            <span className="text-[10px] tabular-nums text-muted-foreground shrink-0 ml-2">
              {progressPct}%
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
}

function ProjectListItem({
  project,
  href,
  hubId,
  voteCount,
  hasVoted,
}: {
  project: Project;
  href: string;
  hubId: string;
  voteCount: number;
  hasVoted: boolean;
}) {
  const color = project.color || getStatusColor(project.status);
  const progressPct = Math.round(project.progress * 100);

  return (
    <div className="flex items-center gap-2">
      <HubVoteButton
        hubId={hubId}
        issueLinearId={project.id}
        initialCount={voteCount}
        initialVoted={hasVoted}
      />
      <Link
        href={href}
        className="flex-1 flex items-center gap-3 border border-border rounded-md px-3 py-2 bg-card hover:bg-accent/50 transition-colors group"
      >
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
            {project.name}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{project.status.name}</span>
            {(project.startDate || project.targetDate) && (
              <span className="flex items-center gap-0.5">
                <Calendar className="w-3 h-3" />
                {project.startDate && formatShort(project.startDate)}
                {project.startDate && project.targetDate && " → "}
                {project.targetDate && formatShort(project.targetDate)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${progressPct}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground w-6 text-right">
            {progressPct}%
          </span>
        </div>
      </Link>
    </div>
  );
}

// -- Helpers ─────────────────────────────────────────────────────────────────

type MonthInfo = { key: string; label: string; widthPct: number };

function generateMonths(start: Date, end: Date): MonthInfo[] {
  const months: MonthInfo[] = [];
  const totalMs = end.getTime() - start.getTime();
  const cursor = new Date(start);

  while (cursor < end) {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + 1);
    const monthMs = Math.min(next.getTime(), end.getTime()) - cursor.getTime();
    const widthPct = totalMs > 0 ? (monthMs / totalMs) * 100 : 0;

    months.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label: cursor.toLocaleDateString("en-US", {
        month: "short",
        year: cursor.getFullYear() !== new Date().getFullYear() ? "2-digit" : undefined,
      }),
      widthPct,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function formatShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
