import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

const VALID_FIELD_TYPES = [
  "text",
  "textarea",
  "select",
  "radio",
  "checkbox",
  "file",
  "url",
];
const VALID_LINEAR_FIELDS = [
  "title",
  "description",
  "priority",
  "label_ids",
  "project_id",
  "cycle_id",
];

/**
 * POST: Add a field to a form.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { formId } = await params;

    // Verify form exists
    const { data: form } = await supabaseAdmin
      .from("form_templates")
      .select("id")
      .eq("id", formId)
      .single();

    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      field_key?: string;
      field_type?: string;
      label?: string;
      description?: string;
      placeholder?: string;
      is_required?: boolean;
      is_hidden?: boolean;
      linear_field?: string | null;
      options?: Array<{ value: string; label: string }>;
      default_value?: string;
    };

    if (!body.field_key?.trim()) {
      return NextResponse.json(
        { error: "field_key is required" },
        { status: 400 }
      );
    }

    if (!body.field_type || !VALID_FIELD_TYPES.includes(body.field_type)) {
      return NextResponse.json(
        { error: `field_type must be one of: ${VALID_FIELD_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (!body.label?.trim()) {
      return NextResponse.json(
        { error: "label is required" },
        { status: 400 }
      );
    }

    if (
      body.linear_field &&
      !VALID_LINEAR_FIELDS.includes(body.linear_field)
    ) {
      return NextResponse.json(
        {
          error: `linear_field must be one of: ${VALID_LINEAR_FIELDS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Get max display_order for this form
    const { data: maxField } = await supabaseAdmin
      .from("form_fields")
      .select("display_order")
      .eq("form_id", formId)
      .order("display_order", { ascending: false })
      .limit(1)
      .single();

    const displayOrder = (maxField?.display_order ?? -1) + 1;

    const { data: field, error } = await supabaseAdmin
      .from("form_fields")
      .insert({
        form_id: formId,
        field_key: body.field_key.trim().toLowerCase().replace(/\s+/g, "_"),
        field_type: body.field_type,
        label: body.label.trim(),
        description: body.description?.trim() || null,
        placeholder: body.placeholder?.trim() || null,
        is_required: body.is_required ?? false,
        is_removable: true,
        is_hidden: body.is_hidden ?? false,
        linear_field: body.linear_field || null,
        options: body.options ?? [],
        default_value: body.default_value ?? null,
        display_order: displayOrder,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // unique constraint violation
        return NextResponse.json(
          { error: "A field with this key already exists" },
          { status: 409 }
        );
      }
      throw new Error(`Failed to create field: ${error.message}`);
    }

    return NextResponse.json(field, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/forms/[formId]/fields error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
