import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET: List all Linear teams from synced data
export async function GET() {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;

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

    return NextResponse.json(teams ?? []);
  } catch (error) {
    console.error("GET /api/admin/linear/teams error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
