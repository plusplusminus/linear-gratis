import { withAuth } from "@workos-inc/authkit-nextjs";
import { isPPMAdmin } from "./ppm-admin";
import type { User } from "@workos-inc/node";

export type AdminAuthResult =
  | { user: User }
  | { error: string; status: 401 | 403 };

/**
 * Auth guard for PPM admin API routes.
 * Verifies the user is authenticated and is a PPM admin.
 *
 * Usage:
 * ```
 * const auth = await withAdminAuth();
 * if ("error" in auth) {
 *   return NextResponse.json({ error: auth.error }, { status: auth.status });
 * }
 * const { user } = auth;
 * ```
 */
export async function withAdminAuth(): Promise<AdminAuthResult> {
  const { user } = await withAuth();
  if (!user) {
    return { error: "Unauthorized", status: 401 };
  }

  const admin = await isPPMAdmin(user.id);
  if (!admin) {
    return { error: "Forbidden", status: 403 };
  }

  return { user };
}
