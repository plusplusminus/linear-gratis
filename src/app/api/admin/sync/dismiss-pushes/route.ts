import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST() {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data, error } = await supabaseAdmin
      .from("hub_comments")
      .update({
        push_status: "dismissed",
        updated_at: new Date().toISOString(),
      })
      .eq("push_status", "failed")
      .select("id");

    if (error) {
      console.error("Failed to dismiss pushes:", error);
      return NextResponse.json(
        { error: "Failed to dismiss pushes" },
        { status: 500 }
      );
    }

    return NextResponse.json({ dismissed: data?.length ?? 0 });
  } catch (error) {
    console.error("POST /api/admin/sync/dismiss-pushes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
