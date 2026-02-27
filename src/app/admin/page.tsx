"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAdminHubs } from "@/hooks/use-admin-hubs";
import { Plus } from "lucide-react";
import Link from "next/link";

export default function AdminPage() {
  const { hubs, loading } = useAdminHubs();
  const router = useRouter();

  useEffect(() => {
    if (!loading && hubs.length > 0) {
      router.replace(`/admin/hubs/${hubs[0].id}`);
    }
  }, [loading, hubs, router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (hubs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Plus className="w-6 h-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-medium mb-2">No client hubs yet</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Create your first client hub to start managing team access and project visibility.
          </p>
          <Link
            href="/admin/hubs/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Hub
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
