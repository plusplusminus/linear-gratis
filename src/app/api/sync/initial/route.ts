import { NextResponse } from "next/server";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { supabaseAdmin } from "@/lib/supabase";
import { runHubSync, type HubSyncResult } from "@/lib/initial-sync";
import type { HubTeamMapping } from "@/lib/supabase";

/**
 * POST: Trigger a workspace-wide sync for all active hubs.
 * This replaces the old per-user sync — now syncs all configured hub teams.
 */
export async function POST() {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all active hubs and their team mappings
    const { data: hubs } = await supabaseAdmin
      .from("client_hubs")
      .select("id")
      .eq("is_active", true);

    if (!hubs || hubs.length === 0) {
      return NextResponse.json(
        { error: "No active hubs configured. Create a hub in the admin panel first." },
        { status: 400 }
      );
    }

    let totalIssues = 0;
    let totalComments = 0;
    let totalTeams = 0;
    let totalProjects = 0;
    let totalInitiatives = 0;

    for (const hub of hubs) {
      const { data: mappings } = await supabaseAdmin
        .from("hub_team_mappings")
        .select("*")
        .eq("hub_id", hub.id)
        .eq("is_active", true);

      if (!mappings || mappings.length === 0) continue;

      const result: HubSyncResult = await runHubSync(
        hub.id,
        mappings as HubTeamMapping[]
      );

      if (result.success) {
        totalTeams += result.teamCount;
        totalInitiatives += result.initiativeCount;
        for (const tr of result.teamResults) {
          totalIssues += tr.issueCount;
          totalComments += tr.commentCount;
          totalProjects += tr.projectCount;
        }
      }
    }

    return NextResponse.json({
      success: true,
      issueCount: totalIssues,
      commentCount: totalComments,
      teamCount: totalTeams,
      projectCount: totalProjects,
      initiativeCount: totalInitiatives,
    });
  } catch (error) {
    console.error("POST /api/sync/initial error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
