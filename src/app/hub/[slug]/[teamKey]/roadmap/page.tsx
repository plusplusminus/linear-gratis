import { resolveHubBySlug } from "@/lib/hub-auth";
import { fetchHubTeams, fetchHubProjects } from "@/lib/hub-read";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { RoadmapTimeline } from "@/components/hub/roadmap-timeline";

export default async function RoadmapPage({
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

  const allProjects = await fetchHubProjects(hub.id);
  const projects = allProjects
    .filter((p) => p.teams.some((t) => t.id === team.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      startDate: p.startDate,
      targetDate: p.targetDate,
      progress: p.progress,
      status: p.status,
    }));

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
        <span className="text-foreground">Roadmap</span>
      </div>

      <div className="px-6 pb-4">
        <h1 className="text-lg font-semibold">Roadmap</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Project timeline for {team.name}
        </p>
      </div>

      <RoadmapTimeline
        projects={projects}
        hubSlug={slug}
        hubId={hub.id}
        teamKey={teamKey}
      />
    </div>
  );
}
