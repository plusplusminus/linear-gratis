import { createIssueInLinear } from "@/lib/linear-push";
import type { WidgetMetadata } from "@/lib/widget-types";

export function buildWidgetIssueDescription(submission: {
  description?: string;
  reporter: { email: string; name?: string };
  metadata: WidgetMetadata;
  screenshotUrl?: string;
}): string {
  const { description, reporter, metadata, screenshotUrl } = submission;
  const lines: string[] = [];

  lines.push("## Feedback");
  lines.push(description || "_No description provided_");
  lines.push("");

  lines.push("## Reporter");
  const name = reporter.name || "Unknown";
  lines.push(`${name} (${reporter.email})`);
  lines.push("");

  lines.push("## Context");
  lines.push(`- **Page:** ${metadata.url}`);
  lines.push(`- **Browser:** ${metadata.userAgent}`);
  lines.push(
    `- **Viewport:** ${metadata.viewport.width}x${metadata.viewport.height}`
  );
  lines.push(`- **Submitted:** ${metadata.timestamp}`);
  lines.push("");

  lines.push("## Sentry");
  if (metadata.sentry?.replayUrl) {
    lines.push(`[Session Replay](${metadata.sentry.replayUrl})`);
  } else {
    lines.push("No replay available");
  }
  lines.push("");

  const errors = metadata.console.filter((c) => c.level === "error");
  lines.push("## Console (last errors)");
  if (errors.length > 0) {
    for (const entry of errors) {
      lines.push(`- ${entry.message}`);
    }
  } else {
    lines.push("_No console errors_");
  }
  lines.push("");

  lines.push("## Screenshot");
  if (screenshotUrl) {
    lines.push(`![Screenshot](${screenshotUrl})`);
  } else {
    lines.push("_No screenshot attached_");
  }
  lines.push("");

  lines.push("---");
  lines.push("*Submitted via Pulse feedback widget*");

  return lines.join("\n");
}

export async function createWidgetLinearIssue(params: {
  teamId: string;
  title: string;
  description: string;
  screenshotUrl?: string;
}): Promise<{ id: string; identifier: string; url: string }> {
  const issue = await createIssueInLinear({
    teamId: params.teamId,
    title: params.title,
    description: params.description,
  });

  return {
    id: issue.id,
    identifier: issue.identifier,
    url: issue.url,
  };
}
