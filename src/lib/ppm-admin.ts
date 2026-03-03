import { supabaseAdmin } from "./supabase";

/**
 * Check if a user is a PPM admin.
 * Checks by user_id first, then falls back to email match.
 * If email matches a row with null user_id, claims it (lazy-claim pattern).
 * No caching — admin list is tiny (~5 users) and changes must take effect immediately.
 */
export async function isPPMAdmin(userId: string, email?: string): Promise<boolean> {
  // Check by user_id first (fast path for already-claimed admins)
  const { data: byId } = await supabaseAdmin
    .from("ppm_admins")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (byId) return true;

  // If email provided, check for unclaimed admin row (user_id is null)
  if (email) {
    const { data: byEmail } = await supabaseAdmin
      .from("ppm_admins")
      .select("id, user_id")
      .eq("email", email.toLowerCase())
      .single();

    if (byEmail && !byEmail.user_id) {
      // Lazy claim: fill in user_id on first login
      // Guard against race: only update if user_id is still null
      const { data: claimed, error: claimError } = await supabaseAdmin
        .from("ppm_admins")
        .update({ user_id: userId })
        .eq("id", byEmail.id)
        .is("user_id", null)
        .select("id")
        .single();

      if (claimError || !claimed) {
        console.error("[isPPMAdmin] lazy claim failed:", claimError);
        return false;
      }
      return true;
    }

    // Email exists but already claimed by a different user_id
    if (byEmail) return false;
  }

  return false;
}
