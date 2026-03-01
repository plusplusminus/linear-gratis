import { resolveHubBySlug } from "@/lib/hub-auth";
import {
  fetchHubTeams,
  fetchHubProjects,
  fetchHubInitiatives,
  fetchHubRoadmapIssues,
  fetchHubMetadata,
} from "@/lib/hub-read";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { GanttChart } from "lucide-react";
import { TeamTabs } from "@/components/hub/team-tabs";

export default async function TeamDashboardPage({
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

  const [allProjects, allInitiatives] = await Promise.all([
    fetchHubProjects(hub.id),
    fetchHubInitiatives(hub.id),
  ]);

  // Filter projects to this team
  const projects = allProjects.filter((p) =>
    p.teams.some((t) => t.id === team.id)
  );

  // Filter initiatives that have at least one project in this team's visible projects
  const projectIds = new Set(projects.map((p) => p.id));
  const initiatives = allInitiatives.filter((init) =>
    init.projects.some((p) => projectIds.has(p.id))
  );

  // Extract milestones from projects
  const milestones = projects
    .flatMap((p) =>
      p.milestones.map((m) => ({
        ...m,
        projectName: p.name,
        projectColor: p.color,
      }))
    )
    .sort((a, b) => {
      if (!a.targetDate) return 1;
      if (!b.targetDate) return -1;
      return a.targetDate.localeCompare(b.targetDate);
    });

  // Fetch issues and metadata for the Issues tab
  const projectIdList = projects.map((p) => p.id);
  const [issues, metadata] = await Promise.all([
    projectIdList.length > 0
      ? fetchHubRoadmapIssues(hub.id, projectIdList)
      : Promise.resolve([]),
    fetchHubMetadata(hub.id, { teamId: team.id }),
  ]);

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
          <span className="text-foreground">{team.name}</span>
        </div>

        {/* Team header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{team.name}</h1>
            <span className="text-[10px] font-mono text-muted-foreground">
              {team.key}
            </span>
          </div>

          {projects.length > 0 && (
            <Link
              href={`/hub/${slug}/${teamKey}/roadmap`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 border border-border transition-colors"
            >
              <GanttChart className="w-3.5 h-3.5" />
              Roadmap
            </Link>
          )}
        </div>
      </div>

      {/* Tabbed content */}
      <TeamTabs
        issues={issues}
        states={metadata.states}
        labels={metadata.labels}
        projects={projects}
        initiatives={initiatives}
        milestones={milestones}
        hubSlug={slug}
        teamKey={teamKey}
        teamId={team.id}
        hubId={hub.id}
      />
    </div>
  );
}

