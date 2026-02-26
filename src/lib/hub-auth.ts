import { withAuth } from "@workos-inc/authkit-nextjs";
import { supabaseAdmin, type HubMemberRole } from "./supabase";
import { isPPMAdmin } from "./ppm-admin";
import type { User } from "@workos-inc/node";

/**
 * Resolve a Client Hub from its slug.
 * Returns the hub ID and WorkOS org ID, or null if not found/inactive.
 */
export async function resolveHubBySlug(slug: string) {
  const { data } = await supabaseAdmin
    .from("client_hubs")
    .select("id, name, slug, workos_org_id, is_active")
    .eq("slug", slug)
    .single();

  if (!data || !data.is_active) return null;
  return data;
}

/**
 * Resolve a Client Hub from a WorkOS Organization ID.
 * Used in auth callback to determine which hub a user logged into.
 */
export async function resolveHubByWorkosOrgId(workosOrgId: string) {
  const { data } = await supabaseAdmin
    .from("client_hubs")
    .select("id, name, slug, workos_org_id, is_active")
    .eq("workos_org_id", workosOrgId)
    .single();

  if (!data || !data.is_active) return null;
  return data;
}

/**
 * Check if a user is a member of a hub and return their role.
 * First checks by user_id, then falls back to email match.
 * If matched by email (first login after invite), fills in user_id.
 * Returns null if not a member.
 */
export async function getHubMembership(
  hubId: string,
  userId: string,
  email?: string
): Promise<{ role: HubMemberRole } | null> {
  // Try direct user_id match first
  const { data: byUserId } = await supabaseAdmin
    .from("hub_members")
    .select("role")
    .eq("hub_id", hubId)
    .eq("user_id", userId)
    .single();

  if (byUserId) {
    return { role: byUserId.role as HubMemberRole };
  }

  // Fall back to email match (invited but not yet accepted)
  if (email) {
    const { data: byEmail } = await supabaseAdmin
      .from("hub_members")
      .select("id, role")
      .eq("hub_id", hubId)
      .eq("email", email.toLowerCase())
      .is("user_id", null)
      .single();

    if (byEmail) {
      // Claim this membership — fill in user_id on first login
      await supabaseAdmin
        .from("hub_members")
        .update({ user_id: userId })
        .eq("id", byEmail.id);

      return { role: byEmail.role as HubMemberRole };
    }
  }

  return null;
}

export type HubAuthResult = {
  user: User;
  hubId: string;
  role: HubMemberRole;
};

export type HubAuthError = {
  error: string;
  status: 401 | 403 | 404;
};

/**
 * Auth guard for hub-scoped API routes.
 * Verifies the user is authenticated and is a member of the hub.
 * Returns user + role, or an error to return as a response.
 *
 * Usage in API routes:
 * ```
 * const auth = await withHubAuth(hubId);
 * if ("error" in auth) {
 *   return NextResponse.json({ error: auth.error }, { status: auth.status });
 * }
 * const { user, role } = auth;
 * ```
 */
export async function withHubAuth(
  hubId: string
): Promise<HubAuthResult | HubAuthError> {
  const { user } = await withAuth();
  if (!user) {
    return { error: "Unauthorized", status: 401 };
  }

  // Verify hub exists
  const { data: hub } = await supabaseAdmin
    .from("client_hubs")
    .select("id, is_active")
    .eq("id", hubId)
    .single();

  if (!hub || !hub.is_active) {
    return { error: "Hub not found", status: 404 };
  }

  // Check membership
  const membership = await getHubMembership(hubId, user.id, user.email);
  if (membership) {
    return { user, hubId, role: membership.role };
  }

  // PPM admin bypass — admins can access any hub with full write access
  const admin = await isPPMAdmin(user.id);
  if (admin) {
    return { user, hubId, role: "admin" };
  }

  return { error: "Not a member of this hub", status: 403 };
}

/**
 * Auth guard for hub-scoped write operations.
 * Same as `withHubAuth` but rejects `view_only` users.
 */
export async function withHubAuthWrite(
  hubId: string
): Promise<HubAuthResult | HubAuthError> {
  const auth = await withHubAuth(hubId);
  if ("error" in auth) return auth;

  if (auth.role === "view_only") {
    return {
      error: "View-only users cannot perform this action",
      status: 403,
    };
  }

  return auth;
}
