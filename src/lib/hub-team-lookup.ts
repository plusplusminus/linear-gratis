import { supabaseAdmin } from "@/lib/supabase";

type TeamHubMapping = {
  hub_id: string;
  linear_team_id: string;
  is_active: boolean;
};

// In-memory cache with TTL
let cachedMappings: Map<string, string[]> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Get a map of linear_team_id → hub_id[].
 * In our model a team belongs to exactly one hub, but the return type
 * is an array for safety.
 *
 * Cached in memory with a 1-minute TTL — hub config changes rarely.
 */
export async function getTeamToHubMap(): Promise<Map<string, string[]>> {
  const now = Date.now();
  if (cachedMappings && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedMappings;
  }

  const { data, error } = await supabaseAdmin
    .from("hub_team_mappings")
    .select("hub_id, linear_team_id, is_active")
    .eq("is_active", true);

  if (error) {
    console.error("Failed to fetch hub team mappings:", error);
    // Return stale cache if available, otherwise empty
    return cachedMappings ?? new Map();
  }

  const map = new Map<string, string[]>();
  for (const row of (data as TeamHubMapping[]) ?? []) {
    const existing = map.get(row.linear_team_id) ?? [];
    existing.push(row.hub_id);
    map.set(row.linear_team_id, existing);
  }

  cachedMappings = map;
  cacheTimestamp = now;
  return map;
}

/**
 * Check if a team is configured in any hub.
 */
export async function isTeamConfigured(teamId: string): Promise<boolean> {
  const map = await getTeamToHubMap();
  return map.has(teamId);
}

/**
 * Get hub IDs for a given team.
 */
export async function getHubsForTeam(teamId: string): Promise<string[]> {
  const map = await getTeamToHubMap();
  return map.get(teamId) ?? [];
}

/**
 * Get all configured team IDs across all hubs.
 */
export async function getAllConfiguredTeamIds(): Promise<Set<string>> {
  const map = await getTeamToHubMap();
  return new Set(map.keys());
}

/**
 * Invalidate the cache (call after hub config changes).
 */
export function invalidateTeamHubCache(): void {
  cachedMappings = null;
  cacheTimestamp = 0;
}
