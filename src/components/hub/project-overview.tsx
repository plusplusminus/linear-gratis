"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

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

export function ProjectOverview({ project }: ProjectOverviewProps) {
  const hasMetadata = project.priority > 0 || project.health || project.lead;
  const hasContent = project.content || project.description;

  return (
    <div className="px-6 py-4 space-y-4">
      {/* Metadata row */}
      {hasMetadata && (
        <div className="flex flex-wrap items-center gap-3">
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
        <div>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Milestones
          </p>
          <div className="space-y-1">
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
      {project.content ? (
        <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-sm prose-headings:font-semibold prose-p:text-[13px] prose-p:leading-relaxed prose-code:text-xs prose-pre:text-xs prose-ul:text-[13px] prose-ol:text-[13px]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {project.content}
          </ReactMarkdown>
        </div>
      ) : project.description ? (
        <p className="text-sm text-muted-foreground">{project.description}</p>
      ) : (
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
      <span className="text-[10px] text-muted-foreground">{label}:</span>
      {children}
    </div>
  );
}
