import { resolveHubBySlug } from "@/lib/hub-auth";
import { fetchHubTeams, fetchHubTeamStats } from "@/lib/hub-read";
import { redirect } from "next/navigation";
import { HubTabs } from "@/components/hub/hub-tabs";

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

  const teamCards = teams.map((team) => {
    const teamStats = stats.get(team.id);
    return {
      id: team.id,
      name: team.name,
      key: team.key,
      projectCount: teamStats?.projectCount ?? 0,
      openIssueCount: teamStats?.openIssueCount ?? 0,
      lastActivity: teamStats?.lastActivity ?? null,
    };
  });

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">{hub.name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Project overview
        </p>
      </div>

      <HubTabs teams={teamCards} hubId={hub.id} hubSlug={slug} />
    </div>
  );
}
