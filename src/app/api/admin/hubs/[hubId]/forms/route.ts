import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchAllGlobalForms } from "@/lib/form-read";

/**
 * GET: Hub form configuration — globals with overrides + hub-specific forms.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { hubId } = await params;

    // Fetch all global forms (including inactive, for admin view)
    const globalForms = await fetchAllGlobalForms();

    // Fetch hub form configs
    const { data: configs } = await supabaseAdmin
      .from("hub_form_config")
      .select("*")
      .eq("hub_id", hubId);

    const configMap = new Map<string, Record<string, unknown>>();
    for (const c of configs ?? []) {
      configMap.set(c.form_id, c);
    }

    // Fetch hub-specific forms
    const { data: hubForms } = await supabaseAdmin
      .from("form_templates")
      .select("*")
      .eq("hub_id", hubId)
      .order("display_order");

    // Build response
    const globalWithConfig = globalForms.map((f) => ({
      ...f,
      _source: "global" as const,
      hub_config: configMap.get(f.id) ?? null,
    }));

    const hubSpecific = (hubForms ?? []).map((f) => ({
      ...f,
      _source: "hub" as const,
      hub_config: null,
    }));

    return NextResponse.json({
      global_forms: globalWithConfig,
      hub_forms: hubSpecific,
    });
  } catch (error) {
    console.error("GET /api/admin/hubs/[hubId]/forms error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a hub-specific form template.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { hubId } = await params;

    const body = (await request.json()) as {
      type?: string;
      name?: string;
      description?: string;
      button_label?: string;
      button_icon?: string;
      target_team_id?: string;
      target_project_id?: string;
      target_cycle_id?: string;
      target_label_ids?: string[];
      target_priority?: number;
      confirmation_message?: string;
      error_message?: string;
    };

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    if (!body.type || !["bug", "feature", "custom"].includes(body.type)) {
      return NextResponse.json(
        { error: "type must be bug, feature, or custom" },
        { status: 400 }
      );
    }

    const { data: form, error } = await supabaseAdmin
      .from("form_templates")
      .insert({
        hub_id: hubId,
        type: body.type,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        button_label: body.button_label?.trim() || null,
        button_icon: body.button_icon || null,
        target_team_id: body.target_team_id || null,
        target_project_id: body.target_project_id || null,
        target_cycle_id: body.target_cycle_id || null,
        target_label_ids: body.target_label_ids ?? [],
        target_priority: body.target_priority ?? null,
        confirmation_message:
          body.confirmation_message?.trim() ||
          "Your request has been submitted successfully.",
        error_message:
          body.error_message?.trim() ||
          "Something went wrong submitting your request. Please try again.",
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create hub form: ${error.message}`);
    }

    // Auto-create title and description fields
    await supabaseAdmin.from("form_fields").insert([
      {
        form_id: form.id,
        field_key: "title",
        field_type: "text",
        label: "Title",
        placeholder: "Brief summary",
        is_required: true,
        is_removable: false,
        linear_field: "title",
        display_order: 0,
      },
      {
        form_id: form.id,
        field_key: "description",
        field_type: "textarea",
        label: "Description",
        placeholder: "Provide details...",
        is_required: true,
        is_removable: false,
        linear_field: "description",
        display_order: 1,
      },
    ]);

    return NextResponse.json(form, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/hubs/[hubId]/forms error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
