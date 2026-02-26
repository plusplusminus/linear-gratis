import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET: List all initiatives from synced data
export async function GET() {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;

    const { data: initiatives, error } = await supabaseAdmin
      .from("synced_initiatives")
      .select("*")
      .eq("user_id", "workspace")
      .order("name", { ascending: true });

    if (error) {
      console.error("GET /api/admin/linear/initiatives error:", error);
      return NextResponse.json(
        { error: "Failed to fetch initiatives" },
        { status: 500 }
      );
    }

    return NextResponse.json(initiatives ?? []);
  } catch (error) {
    console.error("GET /api/admin/linear/initiatives error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
