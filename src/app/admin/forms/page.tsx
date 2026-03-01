"use client";

import Link from "next/link";
import { useFetch } from "@/hooks/use-fetch";
import { cn } from "@/lib/utils";
import { Plus, Loader2 } from "lucide-react";
import type { FormTemplate } from "@/lib/supabase";

type FormListItem = FormTemplate & { field_count: number };

const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  bug: { bg: "var(--badge-orange-bg)", text: "var(--badge-orange-text)", label: "Bug" },
  feature: { bg: "var(--badge-blue-bg)", text: "var(--badge-blue-text)", label: "Feature" },
  custom: { bg: "var(--badge-gray-bg)", text: "var(--badge-gray-text)", label: "Custom" },
};

export default function FormsIndexPage() {
  const { data: forms, loading, error } = useFetch<FormListItem[]>("/api/admin/forms");

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Forms</h1>
        <Link
          href="/admin/forms/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Form
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading forms...
        </div>
      ) : error ? (
        <div className="text-sm text-destructive py-8 text-center">{error}</div>
      ) : !forms || forms.length === 0 ? (
        <div className="border border-border rounded-lg p-8 bg-card text-center">
          <p className="text-sm text-muted-foreground mb-3">No forms yet</p>
          <Link
            href="/admin/forms/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create your first form
          </Link>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_80px_80px_60px] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border bg-muted/30">
            <span>Name</span>
            <span>Type</span>
            <span>Fields</span>
            <span>Status</span>
          </div>

          {forms.map((form, i) => {
            const badge = TYPE_BADGE[form.type] ?? TYPE_BADGE.custom;
            return (
              <Link
                key={form.id}
                href={`/admin/forms/${form.id}`}
                className={cn(
                  "grid grid-cols-[1fr_80px_80px_60px] gap-3 px-4 py-3 items-center hover:bg-accent/50 transition-colors",
                  i < forms.length - 1 && "border-b border-border"
                )}
              >
                <span className="text-sm font-medium truncate">{form.name}</span>
                <span>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
                    style={{ backgroundColor: badge.bg, color: badge.text }}
                  >
                    {badge.label}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {form.field_count}
                </span>
                <span>
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium",
                      form.is_active
                        ? "bg-[var(--badge-green-bg)] text-[var(--badge-green-text)]"
                        : "bg-[var(--badge-gray-bg)] text-[var(--badge-gray-text)]"
                    )}
                  >
                    {form.is_active ? "Active" : "Draft"}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
