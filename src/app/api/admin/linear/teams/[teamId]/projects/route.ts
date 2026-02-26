import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET: List projects for a specific team from synced data
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;

    const { teamId } = await params;

    // Projects have team info in their data JSONB — filter by team_id column
    // or by data->'teams' array. The synced_projects table has a team_id if
    // it was synced per-team, but let's also check the JSONB for robustness.
    const { data: projects, error } = await supabaseAdmin
      .from("synced_projects")
      .select("*")
      .eq("user_id", "workspace")
      .order("name", { ascending: true });

    if (error) {
      console.error(
        "GET /api/admin/linear/teams/[teamId]/projects error:",
        error
      );
      return NextResponse.json(
        { error: "Failed to fetch projects" },
        { status: 500 }
      );
    }

    // Filter projects that belong to the given team
    // Projects may reference teams in their data JSONB (data.teams array)
    const filtered = (projects ?? []).filter((p) => {
      const data = p.data as Record<string, unknown>;
      // Check teams array in JSONB data
      if (Array.isArray(data?.teams)) {
        return (data.teams as Array<{ id?: string }>).some(
          (t) => t.id === teamId
        );
      }
      // Fallback: check if data has a single teamId reference
      if (data?.team && typeof data.team === "object") {
        return (data.team as { id?: string }).id === teamId;
      }
      return false;
    });

    return NextResponse.json(filtered);
  } catch (error) {
    console.error(
      "GET /api/admin/linear/teams/[teamId]/projects error:",
      error
    );
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
