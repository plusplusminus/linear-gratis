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
 * POST: Hub-specific form creation is no longer supported.
 * Global forms should be created at /api/admin/forms and
 * enabled per-hub via hub_form_config.
 */
export async function POST() {
  const auth = await withAdminAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json(
    { error: "Hub-specific form creation is no longer supported. Create global forms instead." },
    { status: 400 }
  );
}
