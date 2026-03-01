import { resolveHubBySlug } from "@/lib/hub-auth";
import {
  fetchHubTeams,
  fetchHubProjects,
  fetchHubRoadmapIssues,
  fetchHubMetadata,
} from "@/lib/hub-read";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ProjectIssueList } from "@/components/hub/project-issue-list";
import { ProjectUpdates } from "@/components/hub/project-updates";

export default async function ProjectViewPage({
  params,
}: {
  params: Promise<{ slug: string; teamKey: string; projectId: string }>;
}) {
  const { slug, teamKey, projectId } = await params;
  const hub = await resolveHubBySlug(slug);
  if (!hub) redirect(`/hub/${slug}/login`);

  const teams = await fetchHubTeams(hub.id);
  const team = teams.find((t) => t.key === teamKey);
  if (!team) notFound();

  const [allProjects, issues, metadata] = await Promise.all([
    fetchHubProjects(hub.id),
    fetchHubRoadmapIssues(hub.id, [projectId]),
    fetchHubMetadata(hub.id, { projectId, teamId: team.id }),
  ]);

  const project = allProjects.find((p) => p.id === projectId);
  if (!project) notFound();

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-6 pt-4 pb-2">
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
        <span className="text-foreground">{project.name}</span>
      </div>

      {/* Project header */}
      <div className="px-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-3 h-3 rounded-full shrink-0"
            style={{
              backgroundColor:
                project.color || project.status.color || "var(--muted-foreground)",
            }}
          />
          <h1 className="text-lg font-semibold">{project.name}</h1>
          <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
            {project.status.name}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Progress */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round(project.progress * 100)}%`,
                  backgroundColor:
                    project.color || project.status.color || "var(--primary)",
                }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {Math.round(project.progress * 100)}%
            </span>
          </div>

          {project.targetDate && (
            <span className="text-[10px] text-muted-foreground">
              Target: {formatDate(project.targetDate)}
            </span>
          )}

          <span className="text-[10px] text-muted-foreground">
            {issues.length} {issues.length === 1 ? "issue" : "issues"}
          </span>
        </div>

        {project.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
            {project.description}
          </p>
        )}
      </div>

      {/* Project Updates */}
      <ProjectUpdates hubId={hub.id} projectId={projectId} />

      {/* Issue list (client component for interactive filtering) */}
      <ProjectIssueList
        issues={issues}
        states={metadata.states}
        labels={metadata.labels}
        cycles={metadata.cycles}
        hubSlug={slug}
        teamKey={teamKey}
        teamId={team.id}
        projectId={projectId}
        hubId={hub.id}
      />
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year:
      d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}
