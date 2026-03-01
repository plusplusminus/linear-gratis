import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * PATCH: Bulk reorder fields.
 * Body: { fieldIds: string[] } — ordered list of field IDs.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { formId } = await params;

    const body = (await request.json()) as { fieldIds?: string[] };

    if (!Array.isArray(body.fieldIds) || body.fieldIds.length === 0) {
      return NextResponse.json(
        { error: "fieldIds array is required" },
        { status: 400 }
      );
    }

    // Update display_order for each field
    const updates = body.fieldIds.map((id, index) =>
      supabaseAdmin
        .from("form_fields")
        .update({ display_order: index, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("form_id", formId)
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "PATCH /api/admin/forms/[formId]/fields/reorder error:",
      error
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
