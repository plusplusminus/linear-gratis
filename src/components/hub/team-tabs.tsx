"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  FolderKanban,
  Target,
  Flag,
  Calendar,
  CircleDot,
  CircleOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectIssueList } from "./project-issue-list";

type Tab = "issues" | "projects" | "initiatives" | "milestones";

const TABS: { key: Tab; label: string }[] = [
  { key: "issues", label: "Issues" },
  { key: "projects", label: "Projects" },
  { key: "initiatives", label: "Initiatives" },
  { key: "milestones", label: "Milestones" },
];

type Project = {
  id: string;
  name: string;
  color?: string;
  progress: number;
  status: { name: string; color: string; type: string };
  targetDate?: string;
  teams: Array<{ id: string }>;
  milestones: Array<{
    id: string;
    name: string;
    targetDate?: string;
  }>;
};

type Initiative = {
  id: string;
  name: string;
  status: string;
  color?: string;
  targetDate?: string;
  projects: Array<{ id: string; name?: string }>;
};

type Milestone = {
  id: string;
  name: string;
  targetDate?: string;
  projectName: string;
  projectColor?: string;
};

type Issue = {
  id: string;
  identifier: string;
  title: string;
  priority: number;
  priorityLabel: string;
  state: { id: string; name: string; color: string; type: string };
  labels: Array<{ id: string; name: string; color: string }>;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  project?: { id: string; name: string; color?: string };
};

export function TeamTabs({
  issues,
  states,
  labels,
  projects,
  initiatives,
  milestones,
  hubSlug,
  teamKey,
  teamId,
  hubId,
}: {
  issues: Issue[];
  states: Array<{ id: string; name: string; color: string; type: string }>;
  labels: Array<{ id: string; name: string; color: string }>;
  projects: Project[];
  initiatives: Initiative[];
  milestones: Milestone[];
  hubSlug: string;
  teamKey: string;
  teamId: string;
  hubId: string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = (searchParams.get("tab") as Tab) || "issues";

  function setTab(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "issues") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
      // Clear issue-specific params when leaving issues tab
      params.delete("q");
      params.delete("status");
      params.delete("priority");
      params.delete("label");
      params.delete("view");
      params.delete("project");
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-border px-6 shrink-0">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count =
            tab.key === "issues"
              ? issues.length
              : tab.key === "projects"
                ? projects.length
                : tab.key === "initiatives"
                  ? initiatives.length
                  : milestones.length;

          return (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              className={cn(
                "relative px-3 py-2.5 text-xs font-medium transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-1.5">
                {tab.label}
                <span
                  className={cn(
                    "tabular-nums text-[10px]",
                    isActive ? "text-foreground/60" : "text-muted-foreground/60"
                  )}
                >
                  {count}
                </span>
              </span>
              {/* Active underline */}
              {isActive && (
                <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-foreground rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "issues" && (
        <ProjectIssueList
          issues={issues}
          states={states}
          labels={labels}
          projects={projects.map((p) => ({
            id: p.id,
            name: p.name,
            color: p.color,
          }))}
          hubSlug={hubSlug}
          teamKey={teamKey}
          teamId={teamId}
          hubId={hubId}
        />
      )}

      {activeTab === "projects" && (
        <div className="p-6 max-w-4xl overflow-y-auto">
          {projects.length === 0 ? (
            <EmptySection message="No projects visible for this team" />
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  href={`/hub/${hubSlug}/${teamKey}/projects/${project.id}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "initiatives" && (
        <div className="p-6 max-w-4xl overflow-y-auto">
          {initiatives.length === 0 ? (
            <EmptySection message="No initiatives linked to this team" />
          ) : (
            <div className="space-y-2">
              {initiatives.map((init) => (
                <InitiativeCard key={init.id} initiative={init} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "milestones" && (
        <div className="p-6 max-w-4xl overflow-y-auto">
          {milestones.length === 0 ? (
            <EmptySection message="No milestones set on visible projects" />
          ) : (
            <div className="space-y-1.5">
              {milestones.map((m, i) => (
                <MilestoneRow key={`${m.id}-${i}`} milestone={m} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -- Sub-components ──────────────────────────────────────────────────────────

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
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{
          backgroundColor:
            project.color ||
            project.status.color ||
            "var(--muted-foreground)",
        }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium group-hover:text-primary transition-colors truncate">
          {project.name}
        </p>
        <StatusBadge status={project.status} />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progressPct}%`,
              backgroundColor:
                project.color ||
                project.status.color ||
                "var(--primary)",
            }}
          />
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground w-7 text-right">
          {progressPct}%
        </span>
      </div>
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
  initiative: Initiative;
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
  milestone: Milestone;
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
