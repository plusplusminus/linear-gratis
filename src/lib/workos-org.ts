import { WorkOS } from "@workos-inc/node";
import { supabaseAdmin } from "@/lib/supabase";

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

/**
 * Create a WorkOS Organization for a Client Hub.
 * Returns the WorkOS Organization ID.
 */
export async function createHubOrganization(hubName: string): Promise<string> {
  const org = await workos.organizations.createOrganization({
    name: hubName,
  });

  return org.id;
}

/**
 * Update a WorkOS Organization name (e.g. when hub is renamed).
 */
export async function updateHubOrganization(
  workosOrgId: string,
  name: string
): Promise<void> {
  await workos.organizations.updateOrganization({
    organization: workosOrgId,
    name,
  });
}

/**
 * Delete a WorkOS Organization (hard cleanup when hub is deleted).
 */
export async function deleteHubOrganization(
  workosOrgId: string
): Promise<void> {
  try {
    await workos.organizations.deleteOrganization(workosOrgId);
  } catch (error) {
    // Log but don't throw — hub deletion should succeed even if WorkOS cleanup fails
    console.error(
      `Failed to delete WorkOS organization ${workosOrgId}:`,
      error
    );
  }
}

/**
 * Get the WorkOS Organization ID for a hub.
 * Returns null if not yet created.
 */
export async function getHubWorkosOrgId(
  hubId: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("client_hubs")
    .select("workos_org_id")
    .eq("id", hubId)
    .single();

  return data?.workos_org_id ?? null;
}
