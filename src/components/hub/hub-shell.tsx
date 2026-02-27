"use client";

import { useMemo } from "react";
import { useHub } from "@/contexts/hub-context";
import { HubSidebar } from "./hub-sidebar";
import { HubTopBar } from "./hub-topbar";

export function HubShell({ children }: { children: React.ReactNode }) {
  const { branding } = useHub();

  const style = useMemo(() => {
    const vars: Record<string, string> = {};
    if (branding.primaryColor) vars["--hub-primary"] = branding.primaryColor;
    if (branding.accentColor) vars["--hub-accent"] = branding.accentColor;
    return Object.keys(vars).length > 0 ? vars : undefined;
  }, [branding.primaryColor, branding.accentColor]);

  return (
    <div
      className="flex h-screen bg-background overflow-hidden"
      style={style as React.CSSProperties | undefined}
    >
      <HubSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <HubTopBar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
