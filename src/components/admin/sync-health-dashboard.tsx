"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// -- Types -------------------------------------------------------------------

type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

type HealthData = {
  status: HealthStatus;
  totalEvents24h: number;
  errorRate: number;
  lastEventAt: string | null;
  lastSyncRunAt: string | null;
};

type SyncEvent = {
  id: string;
  event_type: string;
  action: string;
  entity_id: string;
  team_id: string | null;
  status: string;
  error_message: string | null;
  processing_time_ms: number | null;
  payload_summary: Record<string, unknown> | null;
  created_at: string;
};

type SyncRun = {
  id: string;
  run_type: string;
  hub_id: string | null;
  trigger: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  entities_processed: Record<string, number>;
  errors_count: number;
  error_details: Array<{ message: string }> | null;
  duration_ms: number | null;
};

type Tab = "overview" | "events" | "runs";

// -- Main Component ----------------------------------------------------------

export function SyncHealthDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hubMap, setHubMap] = useState<Record<string, string>>({});

  // Fetch hub id→name map once
  useEffect(() => {
    fetch("/api/admin/hubs")
      .then((r) => r.json() as Promise<{ hubs?: Array<{ id: string; name: string }> }>)
      .then((data) => {
        const map: Record<string, string> = {};
        for (const h of data.hubs ?? []) map[h.id] = h.name;
        setHubMap(map);
      })
      .catch(() => {});
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sync/health");
      if (res.ok) {
        setHealth(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "events", label: "Events" },
    { key: "runs", label: "Runs" },
  ];

  return (
    <div className="space-y-6">
      {/* Health Summary */}
      <HealthSummary health={health} loading={loading} onRefresh={fetchHealth} />

      {/* Quick Actions */}
      <SyncActions onActionComplete={fetchHealth} />

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                activeTab === tab.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab hubMap={hubMap} />}
      {activeTab === "events" && <EventsTab />}
      {activeTab === "runs" && <RunsTab hubMap={hubMap} />}
    </div>
  );
}

// -- Health Summary ----------------------------------------------------------

function HealthSummary({
  health,
  loading,
  onRefresh,
}: {
  health: HealthData | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="border border-border rounded-lg p-4 bg-card">
            <div className="h-4 w-16 bg-muted rounded animate-pulse mb-2" />
            <div className="h-6 w-12 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const statusConfig: Record<
    HealthStatus,
    { icon: React.ReactNode; label: string; color: string; bg: string }
  > = {
    healthy: {
      icon: <CheckCircle2 className="w-5 h-5" />,
      label: "Healthy",
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    degraded: {
      icon: <AlertTriangle className="w-5 h-5" />,
      label: "Degraded",
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
    },
    unhealthy: {
      icon: <XCircle className="w-5 h-5" />,
      label: "Unhealthy",
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    unknown: {
      icon: <HelpCircle className="w-5 h-5" />,
      label: "No Data",
      color: "text-muted-foreground",
      bg: "bg-muted/50",
    },
  };

  const cfg = statusConfig[health?.status ?? "unknown"];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {/* Status indicator — prominent */}
      <div
        className={cn(
          "border border-border rounded-lg p-4",
          cfg.bg
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Status</span>
          <button
            onClick={onRefresh}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        <div className={cn("flex items-center gap-2", cfg.color)}>
          {cfg.icon}
          <span className="text-lg font-semibold">{cfg.label}</span>
        </div>
      </div>

      {/* Events 24h */}
      <div className="border border-border rounded-lg p-4 bg-card">
        <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
          <Activity className="w-3.5 h-3.5" />
          <span className="text-xs">Events (24h)</span>
        </div>
        <p className="text-lg font-semibold tabular-nums">
          {health?.totalEvents24h ?? 0}
        </p>
      </div>

      {/* Error rate */}
      <div className="border border-border rounded-lg p-4 bg-card">
        <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span className="text-xs">Error Rate</span>
        </div>
        <p
          className={cn(
            "text-lg font-semibold tabular-nums",
            (health?.errorRate ?? 0) > 0.05 ? "text-red-500" : ""
          )}
        >
          {((health?.errorRate ?? 0) * 100).toFixed(1)}%
        </p>
      </div>

      {/* Last event */}
      <div className="border border-border rounded-lg p-4 bg-card">
        <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs">Last Event</span>
        </div>
        <p className="text-sm font-medium tabular-nums">
          {health?.lastEventAt ? formatRelativeTime(health.lastEventAt) : "—"}
        </p>
      </div>

      {/* Last sync run */}
      <div className="border border-border rounded-lg p-4 bg-card">
        <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="text-xs">Last Sync Run</span>
        </div>
        <p className="text-sm font-medium tabular-nums">
          {health?.lastSyncRunAt
            ? formatRelativeTime(health.lastSyncRunAt)
            : "—"}
        </p>
      </div>
    </div>
  );
}

// -- Overview Tab ------------------------------------------------------------

function OverviewTab({ hubMap }: { hubMap: Record<string, string> }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Recent Events */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Recent Events</h3>
        <EventsTable limit={10} compact />
      </div>

      {/* Recent Runs */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Recent Runs</h3>
        <RunsTable limit={10} compact hubMap={hubMap} />
      </div>
    </div>
  );
}

// -- Events Tab --------------------------------------------------------------

function EventsTab() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm bg-card border border-border rounded-md px-2 py-1.5 text-foreground"
        >
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="skipped">Skipped</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm bg-card border border-border rounded-md px-2 py-1.5 text-foreground"
        >
          <option value="">All types</option>
          <option value="Issue">Issue</option>
          <option value="Comment">Comment</option>
          <option value="Project">Project</option>
          <option value="Initiative">Initiative</option>
        </select>
      </div>

      <EventsTable statusFilter={statusFilter} typeFilter={typeFilter} />
    </div>
  );
}

// -- Runs Tab ----------------------------------------------------------------

function RunsTab({ hubMap }: { hubMap: Record<string, string> }) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm bg-card border border-border rounded-md px-2 py-1.5 text-foreground"
        >
          <option value="">All statuses</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm bg-card border border-border rounded-md px-2 py-1.5 text-foreground"
        >
          <option value="">All types</option>
          <option value="initial_sync">Initial Sync</option>
          <option value="reconcile">Reconcile</option>
          <option value="hub_sync">Hub Sync</option>
        </select>
      </div>

      <RunsTable statusFilter={statusFilter} typeFilter={typeFilter} hubMap={hubMap} />
    </div>
  );
}

// -- Events Table Component --------------------------------------------------

function EventsTable({
  limit = 50,
  compact = false,
  statusFilter = "",
  typeFilter = "",
}: {
  limit?: number;
  compact?: boolean;
  statusFilter?: string;
  typeFilter?: string;
}) {
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("event_type", typeFilter);

      const res = await fetch(`/api/admin/sync/events?${params}`);
      if (res.ok) {
        const data = (await res.json()) as { events: SyncEvent[]; total: number };
        setEvents(data.events);
        setTotal(data.total);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, typeFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter]);

  if (loading) {
    return <TableSkeleton rows={compact ? 5 : 10} cols={compact ? 4 : 6} />;
  }

  if (events.length === 0) {
    return (
      <div className="border border-border rounded-lg p-8 bg-card text-center">
        <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No events recorded yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Events will appear here as webhooks are received from Linear
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Time</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Type</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Action</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Status</th>
              {!compact && (
                <>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Entity</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">Time (ms)</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr
                key={event.id}
                className={cn(
                  "border-b border-border last:border-b-0 transition-colors",
                  event.status === "error"
                    ? "bg-red-500/5 hover:bg-red-500/10"
                    : "hover:bg-accent/30"
                )}
              >
                <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  {formatTime(event.created_at)}
                </td>
                <td className="px-3 py-2">
                  <EntityTypeBadge type={event.event_type} />
                </td>
                <td className="px-3 py-2 text-xs">{event.action}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={event.status} />
                </td>
                {!compact && (
                  <>
                    <td className="px-3 py-2 text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                      {getEntityLabel(event)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums text-right">
                      {event.processing_time_ms ?? "—"}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!compact && totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}

// -- Runs Table Component ----------------------------------------------------

function RunsTable({
  limit = 50,
  compact = false,
  statusFilter = "",
  typeFilter = "",
  hubMap = {},
}: {
  limit?: number;
  compact?: boolean;
  statusFilter?: string;
  typeFilter?: string;
  hubMap?: Record<string, string>;
}) {
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("run_type", typeFilter);

      const res = await fetch(`/api/admin/sync/runs?${params}`);
      if (res.ok) {
        const data = (await res.json()) as { runs: SyncRun[]; total: number };
        setRuns(data.runs);
        setTotal(data.total);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, typeFilter]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter]);

  if (loading) {
    return <TableSkeleton rows={compact ? 5 : 10} cols={compact ? 4 : 6} />;
  }

  if (runs.length === 0) {
    return (
      <div className="border border-border rounded-lg p-8 bg-card text-center">
        <RefreshCw className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No sync runs recorded yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Runs will appear here when syncs or reconciles are triggered
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Time</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Type</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Hub</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Trigger</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Status</th>
              {!compact && (
                <>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Entities</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">Duration</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr
                key={run.id}
                className={cn(
                  "border-b border-border last:border-b-0 transition-colors",
                  run.status === "failed"
                    ? "bg-red-500/5 hover:bg-red-500/10"
                    : run.status === "running"
                      ? "bg-blue-500/5"
                      : "hover:bg-accent/30"
                )}
              >
                <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  {formatTime(run.started_at)}
                </td>
                <td className="px-3 py-2">
                  <RunTypeBadge type={run.run_type} />
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {run.hub_id ? (hubMap[run.hub_id] ?? "—") : "All"}
                </td>
                <td className="px-3 py-2 text-xs capitalize">{run.trigger}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={run.status} />
                </td>
                {!compact && (
                  <>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatEntities(run.entities_processed)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums text-right">
                      {run.duration_ms != null ? formatDuration(run.duration_ms) : run.status === "running" ? "..." : "—"}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!compact && totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}

// -- Shared UI Components ----------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    success: {
      label: "Success",
      className: "bg-green-500/10 text-green-600 dark:text-green-400",
    },
    completed: {
      label: "Completed",
      className: "bg-green-500/10 text-green-600 dark:text-green-400",
    },
    error: {
      label: "Error",
      className: "bg-red-500/10 text-red-600 dark:text-red-400",
    },
    failed: {
      label: "Failed",
      className: "bg-red-500/10 text-red-600 dark:text-red-400",
    },
    running: {
      label: "Running",
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    skipped: {
      label: "Skipped",
      className: "bg-muted text-muted-foreground",
    },
  };

  const cfg = config[status] ?? {
    label: status,
    className: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  );
}

function EntityTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Issue: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    Comment: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    Project: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    Initiative: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
        colors[type] ?? "bg-muted text-muted-foreground"
      )}
    >
      {type}
    </span>
  );
}

function RunTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    initial_sync: "Initial Sync",
    reconcile: "Reconcile",
    hub_sync: "Hub Sync",
  };

  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
      {labels[type] ?? type}
    </span>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between mt-3">
      <p className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1 rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1 rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function TableSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="border-b border-border bg-muted/30 px-3 py-2">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-3 w-16 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-border last:border-b-0 px-3 py-2.5">
          <div className="flex gap-4">
            {Array.from({ length: cols }).map((_, j) => (
              <div
                key={j}
                className="h-3 bg-muted rounded animate-pulse"
                style={{ width: `${60 + Math.random() * 40}px` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// -- Sync Actions (Corrective) -----------------------------------------------

function SyncActions({ onActionComplete }: { onActionComplete: () => void }) {
  const [hubs, setHubs] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedHub, setSelectedHub] = useState<string>("");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/hubs")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setHubs(data);
          if (data.length > 0) setSelectedHub(data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  async function executeAction(action: string) {
    setConfirmAction(null);
    setActionInProgress(action);

    try {
      let url: string;
      if (action === "reconcile-all") {
        url = "/api/sync/reconcile";
      } else if (action === "sync-hub") {
        url = `/api/admin/hubs/${selectedHub}/sync`;
      } else {
        url = `/api/admin/hubs/${selectedHub}/reconcile`;
      }

      const res = await fetch(url, { method: "POST" });
      const data = (await res.json()) as { error?: string };

      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Action failed");
      }

      const label =
        action === "reconcile-all"
          ? "Full reconcile"
          : action === "sync-hub"
            ? "Hub sync"
            : "Hub reconcile";
      toast.success(`${label} completed successfully`);
      onActionComplete();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionInProgress(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Hub selector */}
      {hubs.length > 0 && (
        <div className="flex items-center gap-2">
          <label htmlFor="hub-selector" className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            Target Hub
          </label>
          <select
            id="hub-selector"
            value={selectedHub}
            onChange={(e) => setSelectedHub(e.target.value)}
            className="text-sm bg-card border border-border rounded-md px-2 py-1.5 text-foreground"
          >
            {hubs.map((hub) => (
              <option key={hub.id} value={hub.id}>
                {hub.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Sync Hub */}
      <ActionButton
        label="Sync Hub"
        tooltip="Fetch latest issues, projects, and cycles from Linear for the selected hub"
        icon={<RefreshCw className="w-3.5 h-3.5" />}
        loading={actionInProgress === "sync-hub"}
        disabled={!selectedHub || actionInProgress !== null}
        confirming={confirmAction === "sync-hub"}
        onConfirmStart={() => setConfirmAction("sync-hub")}
        onConfirm={() => executeAction("sync-hub")}
        onCancel={() => setConfirmAction(null)}
      />

      {/* Reconcile Hub */}
      <ActionButton
        label="Reconcile Hub"
        tooltip="Full re-sync of all data for the selected hub — compares and fixes any drift from Linear"
        icon={<RefreshCw className="w-3.5 h-3.5" />}
        loading={actionInProgress === "reconcile-hub"}
        disabled={!selectedHub || actionInProgress !== null}
        confirming={confirmAction === "reconcile-hub"}
        onConfirmStart={() => setConfirmAction("reconcile-hub")}
        onConfirm={() => executeAction("reconcile-hub")}
        onCancel={() => setConfirmAction(null)}
      />

      <div className="w-px h-6 bg-border" />

      {/* Reconcile All */}
      <ActionButton
        label="Reconcile All"
        tooltip="Full re-sync across every active hub — use sparingly, this hits the Linear API heavily"
        icon={<RefreshCw className="w-3.5 h-3.5" />}
        loading={actionInProgress === "reconcile-all"}
        disabled={actionInProgress !== null}
        confirming={confirmAction === "reconcile-all"}
        onConfirmStart={() => setConfirmAction("reconcile-all")}
        onConfirm={() => executeAction("reconcile-all")}
        onCancel={() => setConfirmAction(null)}
        variant="danger"
      />
    </div>
  );
}

function ActionButton({
  label,
  tooltip,
  icon,
  loading,
  disabled,
  confirming,
  onConfirmStart,
  onConfirm,
  onCancel,
  variant = "default",
}: {
  label: string;
  tooltip?: string;
  icon: React.ReactNode;
  loading: boolean;
  disabled: boolean;
  confirming: boolean;
  onConfirmStart: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "default" | "danger";
}) {
  if (confirming) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Confirm?</span>
        <button
          onClick={onConfirm}
          className="px-2 py-1 text-xs font-medium rounded border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
        >
          Yes
        </button>
        <button
          onClick={onCancel}
          className="px-2 py-1 text-xs font-medium rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onConfirmStart}
      disabled={disabled}
      title={tooltip}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors disabled:opacity-40",
        variant === "danger"
          ? "border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10"
          : "border-border text-muted-foreground hover:text-foreground hover:bg-accent/50"
      )}
    >
      <span className={loading ? "animate-spin" : ""}>{icon}</span>
      {loading ? "Running..." : label}
    </button>
  );
}

// -- Helpers -----------------------------------------------------------------

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();

  if (diffMs < 60_000) return "just now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;

  // Same day
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // Yesterday or older
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();

  if (diffMs < 60_000) return "just now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return `${Math.floor(diffMs / 86_400_000)}d ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1_000)}s`;
}

function formatEntities(entities: Record<string, number>): string {
  const parts: string[] = [];
  if (entities.issues) parts.push(`${entities.issues} issues`);
  if (entities.comments) parts.push(`${entities.comments} comments`);
  if (entities.projects) parts.push(`${entities.projects} proj`);
  if (entities.teams) parts.push(`${entities.teams} teams`);
  if (entities.initiatives) parts.push(`${entities.initiatives} init`);
  return parts.length > 0 ? parts.join(", ") : "—";
}

function getEntityLabel(event: SyncEvent): string {
  const summary = event.payload_summary;
  if (summary) {
    if (typeof summary.identifier === "string") return summary.identifier;
    if (typeof summary.title === "string") return summary.title;
    if (typeof summary.name === "string") return summary.name;
  }
  return event.entity_id.substring(0, 8) + "...";
}
