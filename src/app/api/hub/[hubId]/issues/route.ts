import { NextResponse } from "next/server";
import { withHubAuthWrite, type HubAuthError } from "@/lib/hub-auth";
import { getHubVisibleLabelIds } from "@/lib/hub-read";
import { createIssueInLinear } from "@/lib/linear-push";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const { hubId } = await params;

    const auth = await withHubAuthWrite(hubId);
    if ("error" in auth) {
      return NextResponse.json(
        { error: (auth as HubAuthError).error },
        { status: (auth as HubAuthError).status }
      );
    }

    const body = (await request.json()) as {
      title?: string;
      description?: string;
      priority?: number;
      labelIds?: string[];
      teamId?: string;
      projectId?: string;
    };

    if (!body.title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (!body.teamId) {
      return NextResponse.json(
        { error: "Team ID is required" },
        { status: 400 }
      );
    }

    // Validate labels against hub-visible set
    let labelIds = body.labelIds ?? [];
    if (labelIds.length > 0) {
      const allowedLabelIds = await getHubVisibleLabelIds(hubId, body.teamId);
      if (allowedLabelIds) {
        labelIds = labelIds.filter((id) => allowedLabelIds.includes(id));
      }
    }

    const issue = await createIssueInLinear({
      teamId: body.teamId,
      title: body.title.trim(),
      description: body.description?.trim() || undefined,
      priority: body.priority,
      labelIds: labelIds.length > 0 ? labelIds : undefined,
      projectId: body.projectId || undefined,
    });

    return NextResponse.json({ issue });
  } catch (error) {
    console.error("POST /api/hub/[hubId]/issues error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create issue" },
      { status: 500 }
    );
  }
}
