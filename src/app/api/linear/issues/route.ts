import { NextRequest, NextResponse } from "next/server";
import { fetchSyncedIssues } from "@/lib/sync-read";

export type LinearIssue = {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  priorityLabel: string;
  url: string;
  state: {
    id: string;
    name: string;
    color: string;
    type: string;
  };
  assignee?: {
    id: string;
    name: string;
  };
  labels: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type LinearTeam = {
  id: string;
  name: string;
  key: string;
};

export type RequestBody = {
  projectId?: string;
  teamId?: string;
  statuses?: string[];
};

export async function POST(request: NextRequest) {
  try {
    const { projectId, teamId, statuses } =
      (await request.json()) as RequestBody;

    if (!projectId && !teamId) {
      return NextResponse.json(
        { error: "Either projectId or teamId must be provided" },
        { status: 400 },
      );
    }

    const issues = await fetchSyncedIssues({
      projectId: projectId || undefined,
      teamId: teamId || undefined,
      statuses: statuses && statuses.length > 0 ? statuses : undefined,
    });

    return NextResponse.json({ success: true, issues });
  } catch (error) {
    console.error("Issues API error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    );
  }
}
