import { resolveHubBySlug } from "@/lib/hub-auth";
import { fetchHubTeams, fetchHubProjects, fetchHubInitiatives } from "@/lib/hub-read";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  FolderKanban,
  Target,
  Flag,
  Calendar,
  CircleDot,
  GanttChart,
} from "lucide-react";

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

  return (
    <div className="p-6 max-w-4xl">
      {/* Breadcrumb */}
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
      <div className="flex items-center gap-3 mb-6">
        <TeamBadge name={team.name} color={team.color} icon={team.icon} />
        <div>
          <h1 className="text-lg font-semibold">{team.name}</h1>
          <span className="text-[10px] font-mono text-muted-foreground">
            {team.key}
          </span>
        </div>
      </div>

      {/* Quick nav */}
      {projects.length > 0 && (
        <div className="mb-6">
          <Link
            href={`/hub/${slug}/${teamKey}/roadmap`}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 border border-border transition-colors"
          >
            <GanttChart className="w-3.5 h-3.5" />
            View Roadmap
          </Link>
        </div>
      )}

      {/* Projects */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <FolderKanban className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Projects</h2>
          <span className="text-xs text-muted-foreground">
            {projects.length}
          </span>
        </div>

        {projects.length === 0 ? (
          <EmptySection message="No projects visible for this team" />
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                href={`/hub/${slug}/${teamKey}/projects/${project.id}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* Initiatives */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Initiatives</h2>
          <span className="text-xs text-muted-foreground">
            {initiatives.length}
          </span>
        </div>

        {initiatives.length === 0 ? (
          <EmptySection message="No initiatives linked to this team" />
        ) : (
          <div className="space-y-2">
            {initiatives.map((init) => (
              <InitiativeCard key={init.id} initiative={init} />
            ))}
          </div>
        )}
      </section>

      {/* Milestones */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Flag className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Milestones</h2>
          <span className="text-xs text-muted-foreground">
            {milestones.length}
          </span>
        </div>

        {milestones.length === 0 ? (
          <EmptySection message="No milestones set on visible projects" />
        ) : (
          <div className="space-y-1.5">
            {milestones.map((m, i) => (
              <MilestoneRow key={`${m.id}-${i}`} milestone={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// -- Sub-components ──────────────────────────────────────────────────────────

function TeamBadge({
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
      <div className="w-8 h-8 rounded-md flex items-center justify-center text-base bg-muted">
        {icon}
      </div>
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-semibold text-white/90"
      style={{ backgroundColor: color || "var(--muted-foreground)" }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="border border-border rounded-lg p-6 bg-card text-center">
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

function ProjectCard({
  project,
  href,
}: {
  project: {
    id: string;
    name: string;
    color?: string;
    progress: number;
    status: { name: string; color: string; type: string };
    targetDate?: string;
  };
  href: string;
}) {
  const progressPct = Math.round(project.progress * 100);

  return (
    <Link
      href={href}
      className="flex items-center gap-3 border border-border rounded-lg px-4 py-3 bg-card hover:bg-accent/50 transition-colors group"
    >
      {/* Color dot */}
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: project.color || project.status.color || "var(--muted-foreground)" }}
      />

      {/* Name + status */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium group-hover:text-primary transition-colors truncate">
          {project.name}
        </p>
        <StatusBadge status={project.status} />
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progressPct}%`,
              backgroundColor: project.color || project.status.color || "var(--primary)",
            }}
          />
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground w-7 text-right">
          {progressPct}%
        </span>
      </div>

      {/* Target date */}
      {project.targetDate && (
        <div className="flex items-center gap-1 text-muted-foreground shrink-0">
          <Calendar className="w-3 h-3" />
          <span className="text-[10px] tabular-nums">
            {formatDate(project.targetDate)}
          </span>
        </div>
      )}
    </Link>
  );
}

function StatusBadge({
  status,
}: {
  status: { name: string; color: string; type: string };
}) {
  return (
    <span className="inline-flex items-center gap-1 mt-0.5">
      <CircleDot
        className="w-3 h-3"
        style={{ color: status.color || "var(--muted-foreground)" }}
      />
      <span className="text-[10px] text-muted-foreground">{status.name}</span>
    </span>
  );
}

function InitiativeCard({
  initiative,
}: {
  initiative: {
    id: string;
    name: string;
    status: string;
    color?: string;
    targetDate?: string;
    projects: Array<{ id: string; name?: string }>;
  };
}) {
  return (
    <div className="border border-border rounded-lg px-4 py-3 bg-card">
      <div className="flex items-center gap-2 mb-1.5">
        <Target
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: initiative.color || "var(--muted-foreground)" }}
        />
        <p className="text-sm font-medium truncate">{initiative.name}</p>
        <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted shrink-0">
          {initiative.status}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>
          {initiative.projects.length}{" "}
          {initiative.projects.length === 1 ? "project" : "projects"}
        </span>
        {initiative.targetDate && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(initiative.targetDate)}
          </span>
        )}
      </div>
    </div>
  );
}

function MilestoneRow({
  milestone,
}: {
  milestone: {
    id: string;
    name: string;
    targetDate?: string;
    projectName: string;
    projectColor?: string;
  };
}) {
  const isPast =
    milestone.targetDate && new Date(milestone.targetDate) < new Date();

  return (
    <div className="flex items-center gap-3 px-4 py-2 border border-border rounded-md bg-card">
      <Flag
        className="w-3.5 h-3.5 shrink-0"
        style={{ color: milestone.projectColor || "var(--muted-foreground)" }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{milestone.name}</p>
        <span className="text-[10px] text-muted-foreground">
          {milestone.projectName}
        </span>
      </div>
      {milestone.targetDate && (
        <span
          className={`text-[10px] tabular-nums shrink-0 ${
            isPast ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {formatDate(milestone.targetDate)}
        </span>
      )}
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
