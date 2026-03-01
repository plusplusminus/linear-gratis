"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useHub } from "@/contexts/hub-context";
import { SimpleThemeToggle } from "@/components/theme-toggle";
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
  const { firstName, email, role, isLoading, branding } = useHub();
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
      style={branding.primaryColor ? { borderBottomColor: `${branding.primaryColor}33` } : undefined}
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

            {/* User avatar */}
            <div className="flex items-center gap-2">
              <UserAvatar name={displayName} />
              <span className="text-xs text-muted-foreground hidden sm:block">
                {displayName}
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function UserAvatar({ name }: { name: string }) {
  const initial = (name ?? "?").charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium",
        "bg-muted text-muted-foreground"
      )}
    >
      {initial}
    </div>
  );
}
