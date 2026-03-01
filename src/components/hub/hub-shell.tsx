"use client";

import { HubSidebar } from "./hub-sidebar";
import { HubTopBar } from "./hub-topbar";

export function HubShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <HubSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <HubTopBar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
