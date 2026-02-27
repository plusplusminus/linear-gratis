"use client";

import { AdminSidebar } from "./sidebar";
import { AdminTopBar } from "./top-bar";

interface AdminShellProps {
  user: { id: string; email: string; firstName: string | null };
  children: React.ReactNode;
}

export function AdminShell({ user, children }: AdminShellProps) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminTopBar user={user} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
