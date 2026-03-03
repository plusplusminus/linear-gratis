"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Linear", href: "/admin/settings/linear" },
  { label: "Admins", href: "/admin/settings/admins" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 border-b border-border px-6 pt-4">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "px-3 py-1.5 text-sm font-medium transition-colors -mb-px border-b-2",
            pathname === tab.href
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
