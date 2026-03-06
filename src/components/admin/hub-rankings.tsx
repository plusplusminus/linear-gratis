"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Clock,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CompositeEntry = {
  projectLinearId: string;
  averageRank: number;
  rankerCount: number;
};

type LogEntry = {
  id: string;
  userId: string;
  projectLinearId: string;
  previousRank: number | null;
  newRank: number;
  createdAt: string;
};

type ProjectInfo = {
  id: string;
  name: string;
  color?: string;
};

type LogBatch = {
  key: string;
  userId: string;
  timestamp: string;
  entries: LogEntry[];
};

/** Group log entries into batches by user + time proximity (within 5s = same save) */
function groupIntoBatches(log: LogEntry[]): LogBatch[] {
  const batches: LogBatch[] = [];
  let current: LogBatch | null = null;

  for (const entry of log) {
    const entryTime = new Date(entry.createdAt).getTime();
    const currentTime = current
      ? new Date(current.timestamp).getTime()
      : 0;

    if (
      current &&
      current.userId === entry.userId &&
      Math.abs(entryTime - currentTime) < 5000
    ) {
      current.entries.push(entry);
    } else {
      current = {
        key: entry.id,
        userId: entry.userId,
        timestamp: entry.createdAt,
        entries: [entry],
      };
      batches.push(current);
    }
  }

  return batches;
}

function formatUserName(
  userId: string,
  members: Record<string, string>
): string {
  const email = members[userId];
  if (email) {
    const local = email.split("@")[0];
    return local.charAt(0).toUpperCase() + local.slice(1);
  }
  return userId.slice(0, 12) + "...";
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function HubRankings({
  hubId,
  projects,
}: {
  hubId: string;
  projects: ProjectInfo[];
}) {
  const [composite, setComposite] = useState<CompositeEntry[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [members, setMembers] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"rankings" | "activity">(
    "rankings"
  );
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"rank" | "variance">("rank");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const projectMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );

  useEffect(() => {
    async function load() {
      try {
        const [rankRes, logRes] = await Promise.all([
          fetch(`/api/hubs/${hubId}/rankings`),
          fetch(`/api/hubs/${hubId}/rankings/log?limit=50`),
        ]);

        if (rankRes.ok) {
          const data = (await rankRes.json()) as {
            composite: CompositeEntry[];
          };
          setComposite(data.composite);
        }

        if (logRes.ok) {
          const data = (await logRes.json()) as {
            log: LogEntry[];
            members: Record<string, string>;
          };
          setLog(data.log);
          setMembers(data.members ?? {});
        }
      } catch {
        // Non-critical
      }
      setIsLoading(false);
    }
    load();
  }, [hubId]);

  const sorted = useMemo(() => {
    const entries = [...composite];
    if (sortBy === "variance") {
      return entries.sort(
        (a, b) => b.rankerCount - a.rankerCount || a.averageRank - b.averageRank
      );
    }
    return entries.sort((a, b) => a.averageRank - b.averageRank);
  }, [composite, sortBy]);

  const logByProject = useMemo(() => {
    const map = new Map<string, LogEntry[]>();
    for (const entry of log) {
      if (!map.has(entry.projectLinearId)) map.set(entry.projectLinearId, []);
      map.get(entry.projectLinearId)!.push(entry);
    }
    return map;
  }, [log]);

  const batches = useMemo(() => groupIntoBatches(log), [log]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading ranking data...
      </div>
    );
  }

  if (composite.length === 0 && log.length === 0) {
    return (
      <div className="p-6">
        <div className="border border-border rounded-lg p-8 text-center bg-card">
          <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No clients have ranked projects yet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Rankings will appear here once clients use the Priority view on the
            roadmap
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Tabs */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => setActiveTab("rankings")}
          className={cn(
            "text-sm font-medium pb-1 border-b-2 transition-colors",
            activeTab === "rankings"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Composite Rankings
        </button>
        <button
          onClick={() => setActiveTab("activity")}
          className={cn(
            "text-sm font-medium pb-1 border-b-2 transition-colors",
            activeTab === "activity"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Activity Log
          {log.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-muted text-[10px] tabular-nums">
              {batches.length}
            </span>
          )}
        </button>

        {activeTab === "rankings" && (
          <div className="ml-auto">
            <button
              onClick={() =>
                setSortBy((s) => (s === "rank" ? "variance" : "rank"))
              }
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowUpDown className="w-3 h-3" />
              {sortBy === "rank" ? "By rank" : "By activity"}
            </button>
          </div>
        )}
      </div>

      {activeTab === "rankings" ? (
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          {/* Header */}
          <div className="grid grid-cols-[40px_1fr_80px_80px_60px] gap-2 px-4 py-2 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            <span>#</span>
            <span>Project</span>
            <span className="text-right">Avg Rank</span>
            <span className="text-right">Rankers</span>
            <span />
          </div>

          {sorted.map((entry, index) => {
            const project = projectMap.get(entry.projectLinearId);
            const isExpanded = expanded.has(entry.projectLinearId);

            return (
              <div
                key={entry.projectLinearId}
                className={cn(
                  index < sorted.length - 1 && "border-b border-border"
                )}
              >
                <button
                  onClick={() => toggleExpand(entry.projectLinearId)}
                  className="grid grid-cols-[40px_1fr_80px_80px_60px] gap-2 px-4 py-2.5 w-full text-left hover:bg-accent/30 transition-colors"
                >
                  <span className="text-sm font-medium tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="flex items-center gap-2">
                    {project?.color && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: project.color }}
                      />
                    )}
                    <span className="text-sm truncate">
                      {project?.name ?? entry.projectLinearId}
                    </span>
                  </span>
                  <span className="text-sm tabular-nums text-right">
                    {entry.averageRank.toFixed(1)}
                  </span>
                  <span className="text-sm tabular-nums text-right text-muted-foreground">
                    {entry.rankerCount}
                  </span>
                  <span className="flex justify-end">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </span>
                </button>

                {isExpanded && (() => {
                  const projectLog = logByProject.get(entry.projectLinearId) ?? [];
                  return (
                    <div className="px-4 pb-3 pl-14">
                      <div className="text-xs text-muted-foreground space-y-1">
                        {projectLog.slice(0, 5).map((l) => (
                          <div key={l.id} className="flex items-center gap-2">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>
                              {formatUserName(l.userId, members)} moved from{" "}
                              {l.previousRank ?? "—"} → {l.newRank}
                            </span>
                            <span className="ml-auto text-[10px]">
                              {formatRelativeTime(l.createdAt)}
                            </span>
                          </div>
                        ))}
                        {projectLog.length === 0 && (
                          <span className="text-[10px]">
                            No ranking changes recorded
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      ) : (
        // Activity log tab — grouped by batch
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          {batches.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No ranking activity yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {batches.map((batch) => {
                const userName = formatUserName(batch.userId, members);
                const email = members[batch.userId];
                const isExpanded = expanded.has(batch.key);

                return (
                  <div key={batch.key}>
                    <button
                      onClick={() => toggleExpand(batch.key)}
                      className="flex items-center gap-3 px-4 py-2.5 w-full text-left hover:bg-accent/30 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center shrink-0">
                        <span className="text-xs font-medium text-foreground">
                          {userName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{userName}</span>
                          <span className="text-muted-foreground">
                            {" "}reranked{" "}
                            {batch.entries.length === 1
                              ? "1 project"
                              : `${batch.entries.length} projects`}
                          </span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {email ?? batch.userId} · {formatRelativeTime(batch.timestamp)}
                        </p>
                      </div>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          {batch.entries.length}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3 pl-14 space-y-1">
                        {batch.entries.map((entry) => {
                          const project = projectMap.get(entry.projectLinearId);
                          return (
                            <div
                              key={entry.id}
                              className="flex items-center gap-2 text-xs text-muted-foreground"
                            >
                              {project?.color && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: project.color }}
                                />
                              )}
                              <span className="truncate">
                                {project?.name ?? entry.projectLinearId}
                              </span>
                              <span className="font-mono shrink-0">
                                #{entry.previousRank ?? "—"} → #{entry.newRank}
                              </span>
                              {entry.previousRank !== null &&
                                entry.newRank < entry.previousRank && (
                                  <span className="text-[10px] px-1 rounded bg-emerald-500/10 text-emerald-600">
                                    ↑{entry.previousRank - entry.newRank}
                                  </span>
                                )}
                              {entry.previousRank !== null &&
                                entry.newRank > entry.previousRank && (
                                  <span className="text-[10px] px-1 rounded bg-red-500/10 text-red-600">
                                    ↓{entry.newRank - entry.previousRank}
                                  </span>
                                )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
