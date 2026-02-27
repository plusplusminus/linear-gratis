"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useHub } from "@/contexts/hub-context";
import { useCanInteract } from "@/hooks/use-can-interact";
import { RequestFormModal } from "@/components/hub/request-form";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  MessageSquarePlus,
} from "lucide-react";

type SidebarProject = { id: string; name: string };

export function HubSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [projects, setProjects] = useState<SidebarProject[]>([]);
  const pathname = usePathname();
  const { hubId, hubSlug, hubName, teams, branding, requestFormsEnabled } = useHub();
  const canInteract = useCanInteract();

  const showRequestButton = requestFormsEnabled && canInteract;

  // Fetch projects when request forms are enabled (for the dropdown)
  useEffect(() => {
    if (!requestFormsEnabled) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/hub/${hubId}/projects`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as SidebarProject[];
        if (!cancelled) setProjects(data);
      } catch {
        // Non-critical — projects will load when modal opens
      }
    }
    load();
    return () => { cancelled = true; };
  }, [hubId, requestFormsEnabled]);

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
          <div className="flex items-center gap-2 min-w-0">
            {branding.logoUrl && (
              <img
                src={branding.logoUrl}
                alt={hubName}
                className="h-5 w-auto shrink-0 object-contain"
              />
            )}
            <span className="text-sm font-semibold text-foreground truncate">
              {hubName}
            </span>
          </div>
        )}
        {collapsed && branding.logoUrl && (
          <img
            src={branding.logoUrl}
            alt={hubName}
            className="h-5 w-5 object-contain"
          />
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
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
            style={isOverview ? {
              backgroundColor: branding.primaryColor ? `${branding.primaryColor}1a` : "var(--accent)",
            } : undefined}
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
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
                style={isActive ? {
                  backgroundColor: branding.primaryColor ? `${branding.primaryColor}1a` : "var(--accent)",
                } : undefined}
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

      {/* Submit Request button */}
      {showRequestButton && (
        <div className="px-1.5 py-2 border-t border-border shrink-0">
          <button
            onClick={() => setShowRequestForm(true)}
            className={cn(
              "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors w-full",
              "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
            title={collapsed ? "Submit Request" : undefined}
          >
            <MessageSquarePlus className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">Submit Request</span>}
          </button>
        </div>
      )}

      {/* Request form modal */}
      {showRequestForm && (
        <RequestFormModal
          projects={projects}
          onClose={() => setShowRequestForm(false)}
        />
      )}
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
