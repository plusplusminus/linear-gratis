import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { resolveHubBySlug, getHubMembership } from "@/lib/hub-auth";
import { isPPMAdmin } from "@/lib/ppm-admin";
import { HubAuthProvider } from "@/contexts/hub-auth-context";

export default async function HubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Resolve hub
  const hub = await resolveHubBySlug(slug);
  if (!hub) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="w-full max-w-sm rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center">
          <h1 className="text-lg font-medium text-white">Portal not found</h1>
          <p className="mt-2 text-sm text-neutral-400">
            This client portal does not exist or is no longer active.
          </p>
        </div>
      </div>
    );
  }

  // Check authentication
  const { user, organizationId } = await withAuth();

  if (!user) {
    redirect(`/hub/${slug}/login`);
  }

  // Client users: verify session org matches this hub
  // PPM admins: no organizationId in session, bypass org check
  if (organizationId) {
    if (organizationId !== hub.workos_org_id) {
      redirect(`/hub/${slug}/login`);
    }
  } else {
    // No org — must be a PPM admin (middleware already checked this,
    // but double-check here for safety)
    const admin = await isPPMAdmin(user.id);
    if (!admin) {
      redirect(`/hub/${slug}/login`);
    }
  }

  // Verify hub membership or PPM admin status
  const membership = await getHubMembership(hub.id, user.id, user.email);
  if (!membership) {
    // PPM admin bypass — they're not in hub_members but have full access
    const admin = await isPPMAdmin(user.id);
    if (!admin) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-neutral-950">
          <div className="w-full max-w-sm rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center">
            <h1 className="text-lg font-medium text-white">Access denied</h1>
            <p className="mt-2 text-sm text-neutral-400">
              You are not a member of this portal. Contact your project manager
              for access.
            </p>
          </div>
        </div>
      );
    }
  }

  return <HubAuthProvider hubId={hub.id}>{children}</HubAuthProvider>;
}
