import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin, type HubTeamMapping } from "@/lib/supabase";
import { runHubSync } from "@/lib/initial-sync";
import { startSyncRun, completeSyncRun } from "@/lib/sync-logger";
import { captureServerEvent } from "@/lib/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/posthog-events";

// POST: Trigger initial sync for a hub
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { hubId } = await params;

    // Verify hub exists
    const { data: hub } = await supabaseAdmin
      .from("client_hubs")
      .select("id, name, is_active")
      .eq("id", hubId)
      .single();

    if (!hub) {
      return NextResponse.json(
        { error: "Hub not found" },
        { status: 404 }
      );
    }

    if (!hub.is_active) {
      return NextResponse.json(
        { error: "Hub is not active" },
        { status: 400 }
      );
    }

    // Fetch team mappings for this hub
    const { data: mappings } = await supabaseAdmin
      .from("hub_team_mappings")
      .select("*")
      .eq("hub_id", hubId)
      .eq("is_active", true);

    if (!mappings || mappings.length === 0) {
      return NextResponse.json(
        { error: "No teams configured for this hub" },
        { status: 400 }
      );
    }

    const startedAt = Date.now();
    const runId = await startSyncRun({ runType: "hub_sync", trigger: "manual", hubId });

    const result = await runHubSync(hubId, mappings as HubTeamMapping[]);

    const totalIssues = result.teamResults?.reduce((sum, r) => sum + (r.issueCount ?? 0), 0) ?? 0;
    const totalComments = result.teamResults?.reduce((sum, r) => sum + (r.commentCount ?? 0), 0) ?? 0;
    const totalProjects = result.teamResults?.reduce((sum, r) => sum + (r.projectCount ?? 0), 0) ?? 0;
    const totalCycles = result.teamResults?.reduce((sum, r) => sum + (r.cycleCount ?? 0), 0) ?? 0;

    await completeSyncRun({
      runId,
      status: result.success ? "completed" : "failed",
      entitiesProcessed: {
        issues: totalIssues,
        comments: totalComments,
        projects: totalProjects,
        cycles: totalCycles,
        teams: result.teamCount ?? 0,
        initiatives: result.initiativeCount ?? 0,
      },
      errorsCount: result.success ? 0 : 1,
      startedAt,
    });

    captureServerEvent(auth.user?.id || "system", POSTHOG_EVENTS.sync_completed, {
      hubId,
      success: result.success,
      error: result.error,
      teamCount: result.teamCount,
    });

    return NextResponse.json({
      success: result.success,
      hubId: result.hubId,
      teamCount: result.teamCount,
      initiativeCount: result.initiativeCount,
      teamResults: result.teamResults,
      error: result.error,
    });
  } catch (error) {
    console.error("POST /api/admin/hubs/[hubId]/sync error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
