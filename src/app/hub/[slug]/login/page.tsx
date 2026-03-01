import { getSignInUrl, withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { resolveHubBySlug } from "@/lib/hub-auth";
import { isPPMAdmin } from "@/lib/ppm-admin";

export default async function HubLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Look up the hub
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

  // If already authenticated, check if we can skip login
  const { user, organizationId } = await withAuth();

  if (user) {
    // Already authenticated for this org — go to hub
    if (hub.workos_org_id && organizationId === hub.workos_org_id) {
      redirect(`/hub/${slug}`);
    }

    // PPM admin — can access any hub without org auth
    if (await isPPMAdmin(user.id)) {
      redirect(`/hub/${slug}`);
    }
  }

  // No WorkOS org configured — hub is admin-only for now
  if (!hub.workos_org_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="w-full max-w-sm rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center">
          <h1 className="text-lg font-medium text-white">Portal not configured</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Client login is not yet set up for this hub. Contact your project
            manager.
          </p>
        </div>
      </div>
    );
  }

  // Generate org-scoped sign-in URL
  const returnState = btoa(JSON.stringify({ returnPathname: `/hub/${slug}` }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const signInUrl = await getSignInUrl({
    organizationId: hub.workos_org_id,
    state: returnState,
  });

  // Redirect to WorkOS auth (magic link flow)
  redirect(signInUrl);
}
