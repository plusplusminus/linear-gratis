import { withAuth } from "@workos-inc/authkit-nextjs";
import { resolveHubBySlug } from "@/lib/hub-auth";
import { redirect } from "next/navigation";

export default async function HubDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hub = await resolveHubBySlug(slug);
  if (!hub) redirect(`/hub/${slug}/login`);

  const { user } = await withAuth();
  if (!user) redirect(`/hub/${slug}/login`);

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950">
      <div className="w-full max-w-md rounded-lg border border-neutral-800 bg-neutral-900 p-8 text-center">
        <h1 className="text-xl font-semibold text-white">{hub.name}</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Welcome, {user.firstName ?? user.email}. Hub dashboard coming soon.
        </p>
      </div>
    </div>
  );
}
