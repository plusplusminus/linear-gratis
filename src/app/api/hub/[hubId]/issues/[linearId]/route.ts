import { NextResponse } from "next/server";
import { withHubAuth, withHubAuthWrite, type HubAuthError } from "@/lib/hub-auth";
import {
  fetchHubIssueDetail,
  fetchHubComments,
  fetchHubTeamLabels,
  getHubVisibleLabelIds,
} from "@/lib/hub-read";
import { supabaseAdmin } from "@/lib/supabase";
import { updateIssueLabels } from "@/lib/linear-push";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hubId: string; linearId: string }> }
) {
  try {
    const { hubId, linearId } = await params;

    const auth = await withHubAuth(hubId);
    if ("error" in auth) {
      return NextResponse.json(
        { error: (auth as HubAuthError).error },
        { status: (auth as HubAuthError).status }
      );
    }

    const [issue, comments] = await Promise.all([
      fetchHubIssueDetail(hubId, linearId),
      fetchHubComments(hubId, linearId),
    ]);

    if (!issue) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    // Fetch label definitions from Linear, scoped to the issue's team
    const hubLabels = await fetchHubTeamLabels(hubId, issue.teamId);

    return NextResponse.json({
      issue,
      comments,
      hubLabels,
    });
  } catch (error) {
    console.error("GET /api/hub/[hubId]/issues/[linearId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Add or remove a label on the issue
export async function POST(
  request: Request,
  { params }: { params: Promise<{ hubId: string; linearId: string }> }
) {
  try {
    const { hubId, linearId } = await params;

    const auth = await withHubAuthWrite(hubId);
    if ("error" in auth) {
      return NextResponse.json(
        { error: (auth as HubAuthError).error },
        { status: (auth as HubAuthError).status }
      );
    }

    const { action, labelId } = (await request.json()) as {
      action?: "add" | "remove";
      labelId?: string;
    };

    if (!action || !labelId) {
      return NextResponse.json(
        { error: "action and labelId are required" },
        { status: 400 }
      );
    }

    // Look up the issue's team_id for per-team label scoping
    const { data: issueRow } = await supabaseAdmin
      .from("synced_issues")
      .select("data, team_id")
      .eq("user_id", "workspace")
      .eq("linear_id", linearId)
      .single();

    if (!issueRow) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    }

    const issueTeamId = issueRow.team_id as string;

    // Verify the label is visible for this issue's team
    const allowedLabelIds = await getHubVisibleLabelIds(hubId, issueTeamId);
    if (allowedLabelIds && !allowedLabelIds.includes(labelId)) {
      return NextResponse.json(
        { error: "Label not visible in this hub" },
        { status: 403 }
      );
    }

    const issueData = issueRow.data as Record<string, unknown>;
    const currentLabels = (issueData.labels as Array<{ id: string }>) ?? [];
    const currentLabelIds = currentLabels.map((l) => l.id);

    let newLabelIds: string[];
    if (action === "add") {
      if (currentLabelIds.includes(labelId)) {
        return NextResponse.json({ error: "Label already applied" }, { status: 400 });
      }
      newLabelIds = [...currentLabelIds, labelId];
    } else {
      if (!currentLabelIds.includes(labelId)) {
        return NextResponse.json({ error: "Label not on issue" }, { status: 400 });
      }
      newLabelIds = currentLabelIds.filter((id) => id !== labelId);
    }

    // Push to Linear
    const updatedLabels = await updateIssueLabels(linearId, newLabelIds);

    // Update local synced data
    await supabaseAdmin
      .from("synced_issues")
      .update({
        data: { ...issueData, labels: updatedLabels },
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", "workspace")
      .eq("linear_id", linearId);

    // Filter to hub-visible labels for response
    const visibleLabels = allowedLabelIds
      ? updatedLabels.filter((l) => allowedLabelIds.includes(l.id))
      : updatedLabels;

    return NextResponse.json({ labels: visibleLabels });
  } catch (error) {
    console.error("POST /api/hub/[hubId]/issues/[linearId] labels error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update labels" },
      { status: 500 }
    );
  }
}
