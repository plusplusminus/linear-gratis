import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchHubCycles } from "@/lib/hub-read";
import { HubSettingsForm } from "@/components/admin/hub-settings-form";
import { CycleNamesEditor } from "@/components/admin/cycle-names-editor";

export default async function HubSettingsPage({
  params,
}: {
  params: Promise<{ hubId: string }>;
}) {
  const { hubId } = await params;

  const { data: hub } = await supabaseAdmin
    .from("client_hubs")
    .select("*, hub_team_mappings(*)")
    .eq("id", hubId)
    .single();

  if (!hub) notFound();

  const cycles = await fetchHubCycles(hubId);

  const mappings = (hub.hub_team_mappings ?? []) as Array<{
    id: string;
    linear_team_id: string;
    linear_team_name: string | null;
    visible_project_ids: string[];
    visible_initiative_ids: string[];
    visible_label_ids: string[];
    hidden_label_ids: string[];
    is_active: boolean;
  }>;

  return (
    <div className="p-6">
      <HubSettingsForm
        hub={{
          id: hub.id,
          name: hub.name,
          slug: hub.slug,
          is_active: hub.is_active,
          request_forms_enabled: hub.request_forms_enabled ?? false,
        }}
        mappings={mappings}
      />

      {/* Cycle display name overrides */}
      <div className="mt-10 max-w-2xl">
        <h2 className="text-sm font-semibold mb-1">Cycle Display Names</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Override how cycle names appear to clients in this hub.
        </p>
        <CycleNamesEditor
          hubId={hub.id}
          cycles={cycles.map((c) => ({
            id: c.id,
            name: c.name ?? null,
            number: c.number,
            startsAt: c.startsAt ?? null,
            endsAt: c.endsAt ?? null,
            displayName: (c as { displayName?: string }).displayName,
            team: c.team ? { name: c.team.name } : undefined,
          }))}
        />
      </div>
    </div>
  );
}
