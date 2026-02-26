"use client";

import { useHub } from "@/contexts/hub-context";
import { SimpleThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export function HubTopBar() {
  const { firstName, email, role, isLoading } = useHub();

  const displayName = firstName ?? email;

  return (
    <header className="flex items-center justify-between h-12 px-4 border-b border-border bg-background shrink-0">
      <div />

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
