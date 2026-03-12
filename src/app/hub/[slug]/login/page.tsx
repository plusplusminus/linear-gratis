import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { resolveHubBySlug } from "@/lib/hub-auth";
import { isPPMAdmin } from "@/lib/ppm-admin";
import Link from "next/link";

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
    if (await isPPMAdmin(user.id, user.email)) {
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

  // Build sign-in URL via route handler (avoids cookie-in-RSC error)
  const returnState = btoa(JSON.stringify({ returnPathname: `/hub/${slug}` }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const signInParams = new URLSearchParams({
    organizationId: hub.workos_org_id,
    state: returnState,
  });

  const signInUrl = `/auth/sign-in?${signInParams.toString()}`;

  // Show a sign-in page instead of auto-redirecting to avoid loops
  // when user is authenticated for a different org
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 text-center">
        <h1 className="text-lg font-medium text-foreground">{hub.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to access your client portal
        </p>
        <Link
          href={signInUrl}
          className="mt-6 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
