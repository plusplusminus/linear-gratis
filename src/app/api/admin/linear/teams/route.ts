import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getWorkspaceToken } from "@/lib/workspace";

// GET: List all Linear teams — from synced data, or directly from Linear API if no sync exists yet
export async function GET() {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Try synced data first
    const { data: teams, error } = await supabaseAdmin
      .from("synced_teams")
      .select("*")
      .eq("user_id", "workspace")
      .order("name", { ascending: true });

    if (error) {
      console.error("GET /api/admin/linear/teams error:", error);
      return NextResponse.json(
        { error: "Failed to fetch teams" },
        { status: 500 }
      );
    }

    // If we have synced teams, return them
    if (teams && teams.length > 0) {
      return NextResponse.json(teams);
    }

    // No synced teams yet — fetch directly from Linear API
    let token: string;
    try {
      token = await getWorkspaceToken();
    } catch {
      return NextResponse.json(
        { error: "No Linear API token configured. Add one in Settings first." },
        { status: 400 }
      );
    }

    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({
        query: `query { teams { nodes { id name key color icon } } }`,
      }),
    });

    const result = (await res.json()) as {
      data?: {
        teams: {
          nodes: Array<{
            id: string;
            name: string;
            key: string;
            color?: string;
            icon?: string;
          }>;
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (result.errors || !result.data) {
      return NextResponse.json(
        { error: "Failed to fetch teams from Linear" },
        { status: 500 }
      );
    }

    // Return in the same shape as synced_teams rows
    const liveTeams = result.data.teams.nodes.map((t) => ({
      linear_id: t.id,
      name: t.name,
      key: t.key,
      data: { id: t.id, name: t.name, key: t.key, color: t.color, icon: t.icon },
    }));

    return NextResponse.json(liveTeams);
  } catch (error) {
    console.error("GET /api/admin/linear/teams error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
