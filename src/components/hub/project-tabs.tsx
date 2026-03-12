"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { LinearIssue } from "@/lib/linear";
import { ProjectIssueList } from "./project-issue-list";
import { ProjectUpdates } from "./project-updates";
import { ProjectOverview } from "./project-overview";

export type ProjectLink = {
  id: string;
  label: string;
  url: string;
  createdAt: string;
};

export type ProjectDocument = {
  id: string;
  title: string;
  content?: string;
  slugId: string;
  icon?: string;
  color?: string;
  updatedAt: string;
};

type ProjectTabsProps = {
  project: {
    id: string;
    name: string;
    description?: string;
    content?: string;
    priority: number;
    priorityLabel: string;
    health?: string;
    lead?: { id: string; name: string };
    milestones: Array<{ id: string; name: string; targetDate?: string }>;
    status: { id: string; name: string; color: string; type: string };
  };
  links: ProjectLink[];
  documents: ProjectDocument[];
  isOverviewOnly: boolean;
  issues: LinearIssue[];
  states: Array<{ id: string; name: string; color: string; type: string }>;
  labels: Array<{ id: string; name: string; color: string }>;
  cycles: Array<{ id: string; name: string; number: number }>;
  hubSlug: string;
  teamKey: string;
  teamId: string;
  projectId: string;
  hubId: string;
};

type Tab = "overview" | "issues";

export function ProjectTabs({
  project,
  links,
  documents,
  isOverviewOnly,
  issues,
  states,
  labels,
  cycles,
  hubSlug,
  teamKey,
  teamId,
  projectId,
  hubId,
}: ProjectTabsProps) {
  const hasOverviewContent =
    isOverviewOnly ||
    !!project.content ||
    !!project.description ||
    project.priority > 0 ||
    !!project.health ||
    !!project.lead ||
    project.milestones.length > 0 ||
    links.length > 0 ||
    documents.length > 0;

  const [activeTab, setActiveTab] = useState<Tab>(
    isOverviewOnly || issues.length === 0 ? "overview" : "issues"
  );

  const tabs: { id: Tab; label: string; count?: number }[] = isOverviewOnly
    ? [{ id: "overview", label: "Overview" }]
    : [
        ...(hasOverviewContent
          ? [{ id: "overview" as const, label: "Overview" }]
          : []),
        ...(issues.length > 0
          ? [{ id: "issues" as const, label: "Tasks", count: issues.length }]
          : []),
      ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tab bar — hide when only one tab */}
      {tabs.length > 1 && (
      <div className="flex items-center gap-0 px-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
      )}

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="flex-1 overflow-auto">
          <ProjectOverview project={project} links={links} documents={documents} />
          <ProjectUpdates hubId={hubId} projectId={projectId} />
        </div>
      )}

      {activeTab === "issues" && !isOverviewOnly && (
        <ProjectIssueList
          issues={issues}
          states={states}
          labels={labels}
          cycles={cycles}
          hubSlug={hubSlug}
          teamKey={teamKey}
          teamId={teamId}
          projectId={projectId}
          hubId={hubId}
        />
      )}
    </div>
  );
}
