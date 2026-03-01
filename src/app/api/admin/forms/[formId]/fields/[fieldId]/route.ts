import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * PATCH: Update a field.
 */
export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ formId: string; fieldId: string }> }
) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { formId, fieldId } = await params;

    const body = (await request.json()) as {
      label?: string;
      description?: string;
      placeholder?: string;
      is_required?: boolean;
      is_hidden?: boolean;
      options?: Array<{ value: string; label: string }>;
      default_value?: string | null;
    };

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.label !== undefined) {
      if (!body.label?.trim()) {
        return NextResponse.json(
          { error: "label must be non-empty" },
          { status: 400 }
        );
      }
      updates.label = body.label.trim();
    }
    if (body.description !== undefined)
      updates.description = body.description?.trim() || null;
    if (body.placeholder !== undefined)
      updates.placeholder = body.placeholder?.trim() || null;
    if (body.is_required !== undefined) updates.is_required = body.is_required;
    if (body.is_hidden !== undefined) updates.is_hidden = body.is_hidden;
    if (body.options !== undefined) updates.options = body.options;
    if (body.default_value !== undefined)
      updates.default_value = body.default_value;

    const { data: field, error } = await supabaseAdmin
      .from("form_fields")
      .update(updates)
      .eq("id", fieldId)
      .eq("form_id", formId)
      .select()
      .single();

    if (error || !field) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }

    return NextResponse.json(field);
  } catch (error) {
    console.error(
      "PATCH /api/admin/forms/[formId]/fields/[fieldId] error:",
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

/**
 * DELETE: Remove a field.
 * Blocked if the field is not removable (e.g. title, description).
 */
export async function DELETE(
  _request: Request,
  {
    params,
  }: { params: Promise<{ formId: string; fieldId: string }> }
) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { formId, fieldId } = await params;

    // Check if removable
    const { data: field } = await supabaseAdmin
      .from("form_fields")
      .select("is_removable")
      .eq("id", fieldId)
      .eq("form_id", formId)
      .single();

    if (!field) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }

    if (!field.is_removable) {
      return NextResponse.json(
        { error: "This field cannot be removed" },
        { status: 403 }
      );
    }

    const { error } = await supabaseAdmin
      .from("form_fields")
      .delete()
      .eq("id", fieldId)
      .eq("form_id", formId);

    if (error) {
      throw new Error(`Failed to delete field: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "DELETE /api/admin/forms/[formId]/fields/[fieldId] error:",
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
