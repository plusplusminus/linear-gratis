"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw, Settings } from "lucide-react";
import { useHub } from "@/contexts/hub-context";
import { SimpleThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/hub/notification-bell";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

function useRelativeTime(timestamp: number) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 30) return "Updated just now";
  if (diff < 90) return "Updated 1m ago";
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `Updated ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.floor(hours / 24)}d ago`;
}

export function HubTopBar() {
  const { firstName, email, role, isLoading, hubSlug, hubId } = useHub();
  const router = useRouter();
  const [lastRefreshedAt, setLastRefreshedAt] = useState(Date.now);
  const [refreshing, setRefreshing] = useState(false);
  const relativeTime = useRelativeTime(lastRefreshedAt);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setLastRefreshedAt(Date.now());
    // router.refresh() doesn't return a promise, so use a timeout
    setTimeout(() => setRefreshing(false), 1000);
  }, [router]);

  const displayName = firstName ?? email;

  return (
    <header
      className="flex items-center justify-between h-12 px-4 border-b border-border bg-background shrink-0"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={cn("w-3 h-3", refreshing && "animate-spin")}
          />
          <span>{relativeTime}</span>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell hubId={hubId} hubSlug={hubSlug} />
        <Link
          href={`/hub/${hubSlug}/settings`}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </Link>
        <SimpleThemeToggle />

        {!isLoading && (
          <div className="flex items-center gap-2">
            {/* Role badge */}
            {role === "view_only" && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                View only
              </span>
            )}
            {role === "admin" && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--badge-green-bg)] text-[var(--badge-green-text)]">
                Admin
              </span>
            )}

            {/* User menu with sign out */}
            <UserMenu displayName={displayName} />
          </div>
        )}
      </div>
    </header>
  );
}

