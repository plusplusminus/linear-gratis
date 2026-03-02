import { supabaseAdmin } from "@/lib/supabase";
import { getTeamToHubMap } from "@/lib/hub-team-lookup";

export type HubInfo = {
  id: string;
  slug: string;
  name: string;
};

/**
 * Get hub details for all hubs that include a given team.
 * Returns empty array if the team isn't mapped to any hub.
 */
export async function getHubsForTeam(teamId: string): Promise<HubInfo[]> {
  const map = await getTeamToHubMap();
  const hubIds = map.get(teamId);
  if (!hubIds || hubIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("client_hubs")
    .select("id, slug, name")
    .in("id", hubIds)
    .eq("is_active", true);

  if (error) {
    console.error("getHubsForTeam: failed to fetch hub details:", error);
    return [];
  }

  return (data ?? []) as HubInfo[];
}

/**
 * Get all active hubs (for org-level entities like Initiatives that aren't team-scoped).
 */
export async function getAllActiveHubs(): Promise<HubInfo[]> {
  const { data, error } = await supabaseAdmin
    .from("client_hubs")
    .select("id, slug, name")
    .eq("is_active", true);

  if (error) {
    console.error("getAllActiveHubs: failed to fetch hubs:", error);
    return [];
  }

  return (data ?? []) as HubInfo[];
}

/**
 * Check if a project is visible to a specific hub.
 * A project is visible if it appears in any of the hub's team mappings' visible_project_ids,
 * or if no project filtering is configured (empty array = no filter).
 */
export async function isProjectVisibleToHub(
  hubId: string,
  projectId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("hub_team_mappings")
    .select("visible_project_ids")
    .eq("hub_id", hubId)
    .eq("is_active", true);

  if (error || !data || data.length === 0) return false;

  // If any mapping has an empty visible_project_ids array, there's no project filter
  // for that team — project is visible. If all mappings have non-empty arrays,
  // check if projectId is in the union.
  for (const mapping of data) {
    const ids = mapping.visible_project_ids as string[];
    if (!ids || ids.length === 0) {
      // No project filter for this team = all projects visible
      return true;
    }
    if (ids.includes(projectId)) return true;
  }

  return false;
}

/**
 * Check if an initiative is visible to a specific hub.
 */
export async function isInitiativeVisibleToHub(
  hubId: string,
  initiativeId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("hub_team_mappings")
    .select("visible_initiative_ids")
    .eq("hub_id", hubId)
    .eq("is_active", true);

  if (error || !data || data.length === 0) return false;

  for (const mapping of data) {
    const ids = mapping.visible_initiative_ids as string[];
    if (!ids || ids.length === 0) continue;
    if (ids.includes(initiativeId)) return true;
  }

  return false;
}
