import { FormBuilder } from "@/components/admin/form-builder";
import { supabaseAdmin } from "@/lib/supabase";

export default async function NewHubFormPage({
  params,
}: {
  params: Promise<{ hubId: string }>;
}) {
  const { hubId } = await params;

  const { data: mappings } = await supabaseAdmin
    .from("hub_team_mappings")
    .select("linear_team_id, linear_team_name")
    .eq("hub_id", hubId);

  return (
    <div className="p-6">
      <FormBuilder hubId={hubId} form={null} hubTeams={mappings ?? []} />
    </div>
  );
}
