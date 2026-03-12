"use client";

import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { captureEvent } from "@/lib/posthog-client";
import { POSTHOG_EVENTS } from "@/lib/posthog-events";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

import type { ProjectLink, ProjectDocument } from "./project-tabs";

type ProjectOverviewProps = {
  project: {
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
};

function getHealthColor(health: string): string {
  switch (health.toLowerCase()) {
    case "ontrack":
      return "var(--color-green-500, #22c55e)";
    case "atrisk":
      return "var(--color-yellow-500, #eab308)";
    case "offtrack":
      return "var(--color-red-500, #ef4444)";
    default:
      return "var(--muted-foreground)";
  }
}

function getHealthLabel(health: string): string {
  switch (health.toLowerCase()) {
    case "ontrack":
      return "On Track";
    case "atrisk":
      return "At Risk";
    case "offtrack":
      return "Off Track";
    default:
      return health;
  }
}

function getPriorityIcon(priority: number): string {
  switch (priority) {
    case 1: return "!!!";
    case 2: return "!!";
    case 3: return "!";
    case 4: return "-";
    default: return "";
  }
}

function getPriorityColor(priority: number): string {
  switch (priority) {
    case 1: return "var(--color-red-500, #ef4444)";
    case 2: return "var(--color-orange-500, #f97316)";
    case 3: return "var(--color-yellow-500, #eab308)";
    case 4: return "var(--muted-foreground)";
    default: return "var(--muted-foreground)";
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

export function ProjectOverview({ project, links: _links, documents: _documents }: ProjectOverviewProps) {
  const projectStatus = project.status.name;
  useEffect(() => {
    captureEvent(POSTHOG_EVENTS.project_viewed);
  }, [projectStatus]);

  const hasMetadata = project.priority > 0 || project.health || project.lead;
  const hasContent = project.content || project.description;

  return (
    <div className="px-6 py-5 space-y-0">
      {/* Metadata row */}
      {hasMetadata && (
        <div className="flex flex-wrap items-center gap-4 pb-4">
          {/* Priority */}
          {project.priority > 0 && (
            <MetadataItem label="Priority">
              <span
                className="text-xs font-medium"
                style={{ color: getPriorityColor(project.priority) }}
              >
                {getPriorityIcon(project.priority)} {project.priorityLabel}
              </span>
            </MetadataItem>
          )}

          {/* Health */}
          {project.health && (
            <MetadataItem label="Health">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-medium"
                style={{ color: getHealthColor(project.health) }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: getHealthColor(project.health) }}
                />
                {getHealthLabel(project.health)}
              </span>
            </MetadataItem>
          )}

          {/* Lead */}
          {project.lead && (
            <MetadataItem label="Lead">
              <span className="text-xs text-foreground">{project.lead.name}</span>
            </MetadataItem>
          )}
        </div>
      )}

      {/* Milestones */}
      {project.milestones.length > 0 && (
        <div className={cn(hasMetadata && "border-t border-border pt-4", "pb-4")}>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2.5">
            Milestones
          </p>
          <div className="space-y-1.5">
            {project.milestones.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 text-xs"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                <span className="text-foreground">{m.name}</span>
                {m.targetDate && (
                  <span className="text-muted-foreground">
                    {formatDate(m.targetDate)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full description (content from Linear) */}
      {hasContent && (
        <div className={cn(
          (hasMetadata || project.milestones.length > 0) && "border-t border-border pt-5"
        )}>
          {project.content ? (
            <div className="prose prose-sm dark:prose-invert max-w-prose prose-headings:text-sm prose-headings:font-semibold prose-headings:mt-6 prose-headings:mb-2 prose-p:text-[13px] prose-p:leading-relaxed prose-p:my-2.5 prose-code:text-xs prose-pre:text-xs prose-pre:my-3 prose-ul:text-[13px] prose-ul:my-2.5 prose-ol:text-[13px] prose-ol:my-2.5 prose-li:my-0.5 prose-hr:my-5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {project.content}
              </ReactMarkdown>
            </div>
          ) : project.description ? (
            <p className="text-[13px] leading-relaxed text-muted-foreground max-w-prose">
              {project.description}
            </p>
          ) : null}
        </div>
      )}

      {!hasMetadata && project.milestones.length === 0 && !hasContent && (
        <p className="text-xs text-muted-foreground italic">
          No project description available.
        </p>
      )}
    </div>
  );
}

function MetadataItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      {children}
    </div>
  );
}
