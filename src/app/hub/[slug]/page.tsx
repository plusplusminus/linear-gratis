import { resolveHubBySlug } from "@/lib/hub-auth";
import { fetchHubTeams, fetchHubTeamStats } from "@/lib/hub-read";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Layers, FolderKanban, CircleDot, Clock } from "lucide-react";

export default async function HubLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hub = await resolveHubBySlug(slug);
  if (!hub) redirect(`/hub/${slug}/login`);

  const [teams, stats] = await Promise.all([
    fetchHubTeams(hub.id),
    fetchHubTeamStats(hub.id),
  ]);

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">{hub.name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Project overview
        </p>
      </div>

      {teams.length === 0 ? (
        <div className="border border-border rounded-lg p-10 bg-card text-center">
          <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">No teams configured</p>
          <p className="text-xs text-muted-foreground">
            No teams have been added to this hub yet. Contact your project
            manager.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {teams.map((team) => {
            const teamStats = stats.get(team.id);
            return (
              <TeamCard
                key={team.id}
                name={team.name}
                teamKey={team.key}
                color={team.color}
                icon={team.icon}
                projectCount={teamStats?.projectCount ?? 0}
                openIssueCount={teamStats?.openIssueCount ?? 0}
                lastActivity={teamStats?.lastActivity ?? null}
                href={`/hub/${slug}/${team.key}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function TeamCard({
  name,
  teamKey,
  color,
  icon,
  projectCount,
  openIssueCount,
  lastActivity,
  href,
}: {
  name: string;
  teamKey: string;
  color?: string;
  icon?: string;
  projectCount: number;
  openIssueCount: number;
  lastActivity: string | null;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="border border-border rounded-lg p-4 bg-card hover:bg-accent/50 hover:border-border/80 transition-colors group"
    >
      {/* Team header */}
      <div className="flex items-center gap-3 mb-3">
        <TeamColorBadge name={name} color={color} icon={icon} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium group-hover:text-primary transition-colors truncate">
            {name}
          </p>
          <span className="text-[10px] font-mono text-muted-foreground">
            {teamKey}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FolderKanban className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs">
            {projectCount} {projectCount === 1 ? "project" : "projects"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <CircleDot className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs">
            {openIssueCount} open{" "}
            {openIssueCount === 1 ? "issue" : "issues"}
          </span>
        </div>
        {lastActivity && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs">
              <RelativeTime dateStr={lastActivity} />
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

function TeamColorBadge({
  name,
  color,
  icon,
}: {
  name: string;
  color?: string;
  icon?: string;
}) {
  if (icon) {
    return (
      <div className="w-8 h-8 rounded-md flex items-center justify-center text-base bg-muted shrink-0">
        {icon}
      </div>
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-semibold text-white/90 shrink-0"
      style={{ backgroundColor: color || "var(--muted-foreground)" }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function RelativeTime({ dateStr }: { dateStr: string }) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return <>just now</>;
  if (diffMin < 60) return <>{diffMin}m ago</>;
  if (diffHr < 24) return <>{diffHr}h ago</>;
  if (diffDay < 30) return <>{diffDay}d ago</>;
  return <>{date.toLocaleDateString()}</>;
}
