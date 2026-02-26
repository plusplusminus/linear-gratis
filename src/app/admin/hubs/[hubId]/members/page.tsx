import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { MemberPanel } from "@/components/admin/member-panel";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ hubId: string }>;
}) {
  const { hubId } = await params;

  const { data: hub } = await supabaseAdmin
    .from("client_hubs")
    .select("id, name, workos_org_id")
    .eq("id", hubId)
    .single();

  if (!hub) notFound();

  return (
    <div className="p-6">
      <MemberPanel hubId={hub.id} hubName={hub.name} />
    </div>
  );
}
