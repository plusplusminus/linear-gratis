"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useHub } from "@/contexts/hub-context";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
} from "lucide-react";

export function HubSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { hubSlug, hubName, teams } = useHub();

  const basePath = `/hub/${hubSlug}`;
  const isOverview = pathname === basePath || pathname === `${basePath}/`;

  // Extract active team key from URL: /hub/[slug]/[teamKey]
  const activeTeamKey = pathname.match(
    /\/hub\/[^/]+\/([^/]+)/
  )?.[1];

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-in-out",
        collapsed ? "w-[52px]" : "w-[220px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-12 px-3 border-b border-border shrink-0">
        {!collapsed && (
          <span className="text-sm font-semibold text-foreground truncate">
            {hubName}
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-1.5">
        <nav className="px-1.5 space-y-0.5">
          {/* Overview link */}
          <Link
            href={basePath}
            className={cn(
              "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors group",
              isOverview
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
            title={collapsed ? "Overview" : undefined}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">Overview</span>}
          </Link>

          {/* Team divider */}
          {teams.length > 0 && !collapsed && (
            <div className="pt-3 pb-1 px-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Teams
              </span>
            </div>
          )}
          {teams.length > 0 && collapsed && (
            <div className="pt-2" />
          )}

          {/* Team links */}
          {teams.map((team) => {
            const isActive = activeTeamKey === team.key;
            return (
              <Link
                key={team.id}
                href={`${basePath}/${team.key}`}
                className={cn(
                  "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors group",
                  isActive
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
                title={collapsed ? team.name : undefined}
              >
                <TeamIcon
                  name={team.name}
                  color={team.color}
                  icon={team.icon}
                  active={isActive}
                />
                {!collapsed && (
                  <span className="flex-1 truncate">{team.name}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

function TeamIcon({
  name,
  color,
  icon,
  active,
}: {
  name: string;
  color?: string;
  icon?: string;
  active: boolean;
}) {
  // If the team has an emoji icon from Linear, show it
  if (icon) {
    return (
      <div
        className={cn(
          "w-5 h-5 rounded flex items-center justify-center text-xs shrink-0",
          active ? "bg-accent" : ""
        )}
      >
        {icon}
      </div>
    );
  }

  // Otherwise show a colored initial
  const initial = name.charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        "w-5 h-5 rounded flex items-center justify-center text-[10px] font-semibold shrink-0 transition-colors",
        active
          ? "text-primary-foreground"
          : "text-white/90"
      )}
      style={{
        backgroundColor: color || (active ? "var(--primary)" : "var(--muted-foreground)"),
        opacity: active ? 1 : 0.7,
      }}
    >
      {initial}
    </div>
  );
}
