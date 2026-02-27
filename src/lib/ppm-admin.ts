import { supabaseAdmin } from "./supabase";

/**
 * Check if a user is a PPM admin.
 * No caching — admin list is tiny (~5 users) and changes must take effect immediately.
 */
export async function isPPMAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("ppm_admins")
    .select("user_id")
    .eq("user_id", userId)
    .single();

  return !!data;
}
