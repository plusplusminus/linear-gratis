import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTeamHubCache } from "@/lib/hub-team-lookup";

// POST: Add a team mapping to a hub
export async function POST(
  request: Request,
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
      .select("id")
      .eq("id", hubId)
      .single();

    if (!hub) {
      return NextResponse.json({ error: "Hub not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      linear_team_id?: string;
      visible_project_ids?: string[];
      visible_initiative_ids?: string[];
      visible_label_ids?: string[];
    };

    if (!body.linear_team_id || typeof body.linear_team_id !== "string") {
      return NextResponse.json(
        { error: "linear_team_id is required" },
        { status: 400 }
      );
    }

    // Check if team is already mapped to another active hub
    // (partial unique index: idx_hub_team_mappings_team_exclusive)
    const { data: existing } = await supabaseAdmin
      .from("hub_team_mappings")
      .select("id, hub_id")
      .eq("linear_team_id", body.linear_team_id)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error: `Team is already mapped to hub ${existing.hub_id}`,
        },
        { status: 409 }
      );
    }

    // Look up team name from synced data
    const { data: team } = await supabaseAdmin
      .from("synced_teams")
      .select("name")
      .eq("linear_id", body.linear_team_id)
      .eq("user_id", "workspace")
      .maybeSingle();

    const { data: mapping, error } = await supabaseAdmin
      .from("hub_team_mappings")
      .insert({
        hub_id: hubId,
        linear_team_id: body.linear_team_id,
        linear_team_name: team?.name ?? null,
        visible_project_ids: body.visible_project_ids ?? [],
        visible_initiative_ids: body.visible_initiative_ids ?? [],
        visible_label_ids: body.visible_label_ids ?? [],
      })
      .select()
      .single();

    if (error) {
      console.error("POST /api/admin/hubs/[hubId]/teams insert error:", error);
      return NextResponse.json(
        { error: "Failed to create team mapping" },
        { status: 500 }
      );
    }

    invalidateTeamHubCache();

    return NextResponse.json(mapping, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/hubs/[hubId]/teams error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
