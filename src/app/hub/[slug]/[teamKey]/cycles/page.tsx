import { resolveHubBySlug } from "@/lib/hub-auth";
import {
  fetchHubTeams,
  fetchHubCycles,
  fetchHubCycleStats,
} from "@/lib/hub-read";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { IterationCw } from "lucide-react";

function formatCycleDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year:
      d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function formatDateRange(
  startsAt: string | null,
  endsAt: string | null
): string | null {
  if (!startsAt || !endsAt) return null;
  return `${formatCycleDate(startsAt)} – ${formatCycleDate(endsAt)}`;
}

type Cycle = {
  id: string;
  name: string | null;
  number: number;
  description?: string;
  startsAt: string | null;
  endsAt: string | null;
  completedAt?: string;
  progress: number;
  isCurrent: boolean;
  isUpcoming: boolean;
  displayName?: string;
  team?: { id?: string; name?: string; key?: string };
};

function CycleCard({
  cycle,
  stats,
}: {
  cycle: Cycle;
  stats: { total: number; completed: number } | undefined;
}) {
  const total = stats?.total ?? 0;
  const completed = stats?.completed ?? 0;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const cycleName =
    cycle.displayName || cycle.name || `Cycle ${cycle.number}`;
  const dateRange = formatDateRange(cycle.startsAt, cycle.endsAt);

  return (
    <div
      className={`border rounded-lg px-4 py-3 bg-card transition-colors ${
        cycle.isCurrent
          ? "border-l-2 border-l-primary/60 border-t-border border-r-border border-b-border bg-primary/[0.02]"
          : "border-border"
      }`}
    >
      <div className="flex items-center gap-3">
        <IterationCw
          className={`w-3.5 h-3.5 shrink-0 ${
            cycle.isCurrent
              ? "text-primary/70"
              : "text-muted-foreground"
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{cycleName}</p>
            {cycle.isCurrent && (
              <span className="text-[10px] font-medium text-primary/80 px-1.5 py-0.5 rounded bg-primary/10 shrink-0">
                Current
              </span>
            )}
            {cycle.isUpcoming && (
              <span className="text-[10px] font-medium text-muted-foreground px-1.5 py-0.5 rounded bg-muted shrink-0">
                Upcoming
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {dateRange && (
              <span className="text-[10px] text-muted-foreground">
                {dateRange}
              </span>
            )}
            {total > 0 && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {completed} / {total} issues completed
              </span>
            )}
          </div>
        </div>
        {total > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: cycle.isCurrent
                    ? "var(--primary)"
                    : "var(--muted-foreground)",
                }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground w-7 text-right">
              {progressPct}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function CycleSection({
  title,
  cycles,
  allStats,
}: {
  title: string;
  cycles: Cycle[];
  allStats: Record<string, { total: number; completed: number }>;
}) {
  if (cycles.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {title}
      </h3>
      <div className="space-y-1.5">
        {cycles.map((cycle) => (
          <CycleCard key={cycle.id} cycle={cycle} stats={allStats[cycle.id]} />
        ))}
      </div>
    </div>
  );
}

export default async function CyclesPage({
  params,
}: {
  params: Promise<{ slug: string; teamKey: string }>;
}) {
  const { slug, teamKey } = await params;
  const hub = await resolveHubBySlug(slug);
  if (!hub) redirect(`/hub/${slug}/login`);

  const teams = await fetchHubTeams(hub.id);
  const team = teams.find((t) => t.key === teamKey);
  if (!team) notFound();

  const cycles = await fetchHubCycles(hub.id, { teamId: team.id });
  const cycleIds = cycles.map((c) => c.id);
  const stats = await fetchHubCycleStats(hub.id, cycleIds);

  const currentCycles = cycles.filter((c) => c.isCurrent);
  const upcomingCycles = cycles.filter((c) => c.isUpcoming);
  const completedCycles = cycles.filter(
    (c) => !c.isCurrent && !c.isUpcoming
  );

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb */}
      <div className="px-6 pt-6">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
          <Link
            href={`/hub/${slug}`}
            className="hover:text-foreground transition-colors"
          >
            {hub.name}
          </Link>
          <span>/</span>
          <Link
            href={`/hub/${slug}/${teamKey}`}
            className="hover:text-foreground transition-colors"
          >
            {team.name}
          </Link>
          <span>/</span>
          <span className="text-foreground">Cycles</span>
        </div>

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <IterationCw className="w-4 h-4 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Cycles</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {cycles.length === 0 ? (
          <div className="border border-border rounded-lg p-6 bg-card text-center">
            <p className="text-xs text-muted-foreground">
              This team doesn&apos;t use cycles
            </p>
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl">
            <CycleSection
              title="Active"
              cycles={currentCycles}
              allStats={stats}
            />
            <CycleSection
              title="Upcoming"
              cycles={upcomingCycles}
              allStats={stats}
            />
            <CycleSection
              title="Completed"
              cycles={completedCycles}
              allStats={stats}
            />
          </div>
        )}
      </div>
    </div>
  );
}
