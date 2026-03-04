"use client";

import { useMemo } from "react";

type Project = {
  id: string;
  name: string;
  color?: string;
  progress: number;
  startDate?: string;
  targetDate?: string;
  status: { name: string; color: string; type: string };
  labels: Array<{ id: string; name: string; color: string }>;
};

export function RoadmapTimeline({ projects }: { projects: Project[] }) {
  const { months, timelineStart, totalDays } = useMemo(() => {
    const now = new Date();
    const dates: Date[] = [];

    for (const p of projects) {
      if (p.startDate) dates.push(new Date(p.startDate));
      if (p.targetDate) dates.push(new Date(p.targetDate));
    }

    if (dates.length === 0) {
      dates.push(new Date(now.getFullYear(), now.getMonth(), 1));
      dates.push(new Date(now.getFullYear(), now.getMonth() + 3, 0));
    }

    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Pad by 2 weeks on each side, align to month boundaries
    const start = new Date(minDate);
    start.setDate(start.getDate() - 14);
    start.setDate(1);
    const end = new Date(maxDate);
    end.setDate(end.getDate() + 14);
    end.setMonth(end.getMonth() + 1, 0);

    const diff = end.getTime() - start.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    const monthLabels: { label: string; offset: number; width: number }[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const monthStart = new Date(cursor);
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const clampedEnd = monthEnd > end ? end : monthEnd;
      const startDay = Math.max(0, Math.ceil((monthStart.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const endDay = Math.ceil((clampedEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      monthLabels.push({
        label: monthStart.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        offset: (startDay / days) * 100,
        width: ((endDay - startDay) / days) * 100,
      });
      cursor.setMonth(cursor.getMonth() + 1, 1);
    }

    return { months: monthLabels, timelineStart: start, totalDays: days };
  }, [projects]);

  const todayOffset = useMemo(() => {
    const now = new Date();
    const diff = now.getTime() - timelineStart.getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    return (days / totalDays) * 100;
  }, [timelineStart, totalDays]);

  function getBarStyle(project: Project) {
    const startDate = project.startDate ? new Date(project.startDate) : null;
    const endDate = project.targetDate ? new Date(project.targetDate) : null;

    if (!startDate && !endDate) return null;

    const barStart = startDate ?? endDate!;
    const barEnd = endDate ?? startDate!;

    const startDiff = (barStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
    const endDiff = (barEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);

    const left = (startDiff / totalDays) * 100;
    const width = Math.max(((endDiff - startDiff) / totalDays) * 100, 0.5);

    return { left: `${left}%`, width: `${width}%` };
  }

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const typeOrder: Record<string, number> = { started: 0, planned: 1, paused: 2, completed: 3, cancelled: 4 };
      const oa = typeOrder[a.status.type] ?? 1;
      const ob = typeOrder[b.status.type] ?? 1;
      if (oa !== ob) return oa - ob;
      const da = a.startDate ?? a.targetDate ?? "9999";
      const db = b.startDate ?? b.targetDate ?? "9999";
      return da.localeCompare(db);
    });
  }, [projects]);

  return (
    <div className="min-w-[600px]">
      {/* Month headers */}
      <div className="relative h-8 border-b border-border mb-2">
        {months.map((m, i) => (
          <div
            key={i}
            className="absolute top-0 h-full flex items-center text-[10px] font-medium text-muted-foreground border-l border-border/50 px-2"
            style={{ left: `${m.offset}%`, width: `${m.width}%` }}
          >
            {m.label}
          </div>
        ))}
        {todayOffset >= 0 && todayOffset <= 100 && (
          <div
            className="absolute top-0 h-full w-px bg-primary/60 z-10"
            style={{ left: `${todayOffset}%` }}
          >
            <span className="absolute -top-0.5 -translate-x-1/2 text-[8px] text-primary font-medium px-1 bg-background rounded">
              Today
            </span>
          </div>
        )}
      </div>

      {/* Project rows */}
      <div className="space-y-1">
        {sortedProjects.map((project) => {
          const barStyle = getBarStyle(project);
          const progressPct = Math.round(project.progress * 100);
          const color = project.color || project.status.color || "var(--primary)";

          return (
            <div key={project.id} className="relative h-10 group">
              {/* Grid lines */}
              {months.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-border/20"
                  style={{ left: `${m.offset}%` }}
                />
              ))}

              {todayOffset >= 0 && todayOffset <= 100 && (
                <div
                  className="absolute top-0 h-full w-px bg-primary/20"
                  style={{ left: `${todayOffset}%` }}
                />
              )}

              {barStyle ? (
                <div
                  className="absolute top-1 h-8 rounded-md overflow-hidden border border-border/30 bg-card group-hover:border-border/60 transition-colors"
                  style={{ ...barStyle, minWidth: "120px" }}
                >
                  <div
                    className="absolute inset-0 opacity-15"
                    style={{ backgroundColor: color, width: `${progressPct}%` }}
                  />
                  <div className="relative flex items-center gap-2 h-full px-2.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-medium truncate flex-1">
                      {project.name}
                    </span>
                    <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
                      {progressPct}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 h-full px-2.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {project.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 italic">
                    No dates set
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
