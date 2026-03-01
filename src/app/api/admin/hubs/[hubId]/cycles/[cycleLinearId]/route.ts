import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * PUT: Set or clear a display name override for a cycle within a hub.
 * Send { displayName: "Sprint 42" } to set, or { displayName: null } to clear.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ hubId: string; cycleLinearId: string }> }
) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { hubId, cycleLinearId } = await params;
    const body = (await request.json()) as { displayName?: string | null };
    const displayName = body.displayName ?? null;

    if (displayName) {
      const { error } = await supabaseAdmin
        .from("cycle_display_names")
        .upsert(
          {
            hub_id: hubId,
            cycle_linear_id: cycleLinearId,
            display_name: displayName,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "hub_id,cycle_linear_id" }
        );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      await supabaseAdmin
        .from("cycle_display_names")
        .delete()
        .eq("hub_id", hubId)
        .eq("cycle_linear_id", cycleLinearId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "PUT /api/admin/hubs/[hubId]/cycles/[cycleLinearId] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
