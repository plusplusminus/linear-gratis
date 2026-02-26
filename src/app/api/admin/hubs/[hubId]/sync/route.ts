import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin, type HubTeamMapping } from "@/lib/supabase";
import { runHubSync } from "@/lib/initial-sync";

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
    const { user } = auth;

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

    const result = await runHubSync(hubId, mappings as HubTeamMapping[]);

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
