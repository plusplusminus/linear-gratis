"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { LinearIssue } from "@/lib/linear";
import { ProjectIssueList } from "./project-issue-list";
import { ProjectUpdates } from "./project-updates";
import { ProjectOverview } from "./project-overview";

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
  const [activeTab, setActiveTab] = useState<Tab>(
    isOverviewOnly ? "overview" : "issues"
  );

  const tabs: { id: Tab; label: string; count?: number }[] = isOverviewOnly
    ? [{ id: "overview", label: "Overview" }]
    : [
        { id: "overview", label: "Overview" },
        { id: "issues", label: "Issues", count: issues.length },
      ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Tab bar */}
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

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="flex-1 overflow-auto">
          <ProjectOverview project={project} />
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
