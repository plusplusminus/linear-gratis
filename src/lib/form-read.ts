import {
  supabaseAdmin,
  type FormTemplate,
  type FormField,
  type HubFormConfig,
} from "./supabase";

// -- Types ────────────────────────────────────────────────────────────────────

export type FormWithFields = FormTemplate & {
  fields: FormField[];
};

export type ResolvedForm = FormTemplate & {
  hub_config?: HubFormConfig | null;
};

export type FormRouting = {
  teamId: string | null;
  projectId: string | null;
  cycleId: string | null;
  labelIds: string[];
  priority: number | null;
};

// -- Queries ──────────────────────────────────────────────────────────────────

/**
 * All active global form templates (hub_id IS NULL).
 */
export async function fetchGlobalForms(): Promise<FormTemplate[]> {
  const { data, error } = await supabaseAdmin
    .from("form_templates")
    .select("*")
    .is("hub_id", null)
    .eq("is_active", true)
    .order("display_order");

  if (error) throw new Error(`fetchGlobalForms: ${error.message}`);
  return data ?? [];
}

/**
 * All global forms (active or not) for admin listing.
 */
export async function fetchAllGlobalForms(): Promise<FormTemplate[]> {
  const { data, error } = await supabaseAdmin
    .from("form_templates")
    .select("*")
    .is("hub_id", null)
    .order("display_order");

  if (error) throw new Error(`fetchAllGlobalForms: ${error.message}`);
  return data ?? [];
}

/**
 * Returns the merged list of forms visible to a hub:
 * - Global forms with hub_form_config overrides applied
 * - Hub-specific forms
 * Both filtered by is_active + hub_form_config.is_enabled (where applicable).
 */
export async function fetchHubForms(hubId: string): Promise<ResolvedForm[]> {
  // 1. Fetch active global forms
  const globalForms = await fetchGlobalForms();

  // 2. Fetch hub-specific forms
  const { data: hubForms, error: hubErr } = await supabaseAdmin
    .from("form_templates")
    .select("*")
    .eq("hub_id", hubId)
    .eq("is_active", true)
    .order("display_order");

  if (hubErr) throw new Error(`fetchHubForms (hub-specific): ${hubErr.message}`);

  // 3. Fetch hub overrides for global forms
  const { data: configs, error: cfgErr } = await supabaseAdmin
    .from("hub_form_config")
    .select("*")
    .eq("hub_id", hubId);

  if (cfgErr) throw new Error(`fetchHubForms (config): ${cfgErr.message}`);

  const configByFormId = new Map<string, HubFormConfig>();
  for (const cfg of configs ?? []) {
    configByFormId.set(cfg.form_id, cfg);
  }

  // 4. Merge: global forms filtered by hub config
  const resolved: ResolvedForm[] = [];

  for (const form of globalForms) {
    const cfg = configByFormId.get(form.id);
    // If there's a hub config and it's disabled, skip
    if (cfg && !cfg.is_enabled) continue;
    resolved.push({ ...form, hub_config: cfg ?? null });
  }

  // 5. Add hub-specific forms
  for (const form of hubForms ?? []) {
    resolved.push({ ...form, hub_config: null });
  }

  return resolved;
}

/**
 * Single form template with its ordered fields.
 */
export async function fetchFormWithFields(
  formId: string
): Promise<FormWithFields | null> {
  const { data: form, error: formErr } = await supabaseAdmin
    .from("form_templates")
    .select("*")
    .eq("id", formId)
    .single();

  if (formErr) {
    if (formErr.code === "PGRST116") return null; // not found
    throw new Error(`fetchFormWithFields: ${formErr.message}`);
  }

  const { data: fields, error: fieldsErr } = await supabaseAdmin
    .from("form_fields")
    .select("*")
    .eq("form_id", formId)
    .order("display_order");

  if (fieldsErr) throw new Error(`fetchFormWithFields (fields): ${fieldsErr.message}`);

  return { ...form, fields: fields ?? [] };
}

/**
 * Fetch hub form config for a specific form+hub combo.
 */
export async function fetchHubFormConfig(
  hubId: string,
  formId: string
): Promise<HubFormConfig | null> {
  const { data, error } = await supabaseAdmin
    .from("hub_form_config")
    .select("*")
    .eq("hub_id", hubId)
    .eq("form_id", formId)
    .maybeSingle();

  if (error) throw new Error(`fetchHubFormConfig: ${error.message}`);
  return data;
}

/**
 * Merge hub overrides onto form defaults to get effective routing.
 */
export function resolveFormRouting(
  form: FormTemplate,
  hubConfig?: HubFormConfig | null
): FormRouting {
  return {
    teamId: hubConfig?.target_team_id ?? form.target_team_id,
    projectId: hubConfig?.target_project_id ?? form.target_project_id,
    cycleId: hubConfig?.target_cycle_id ?? form.target_cycle_id,
    labelIds: hubConfig?.target_label_ids ?? form.target_label_ids ?? [],
    priority: hubConfig?.target_priority ?? form.target_priority,
  };
}
