"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ScopingEditor } from "./scoping-editor";
import { AlertTriangle } from "lucide-react";

interface TeamMapping {
  id: string;
  linear_team_id: string;
  linear_team_name: string | null;
  visible_project_ids: string[];
  visible_initiative_ids: string[];
  visible_label_ids: string[];
  is_active: boolean;
}

interface HubSettingsFormProps {
  hub: { id: string; name: string; slug: string; is_active: boolean };
  mappings: TeamMapping[];
}

type Tab = "general" | "scoping" | "danger";

export function HubSettingsForm({ hub, mappings }: HubSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("general");

  // General state
  const [name, setName] = useState(hub.name);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDirty(name !== hub.name);
  }, [name, hub.name]);

  // Warn on navigation with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const saveGeneral = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/hubs/${hub.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Failed to save");
        }
        toast.success("Hub settings saved");
        setDirty(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }, [hub.id, name, router]);

  const deactivateHub = useCallback(() => {
    if (!confirm(`Are you sure you want to ${hub.is_active ? "deactivate" : "reactivate"} "${hub.name}"?`)) {
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/hubs/${hub.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !hub.is_active }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Failed to update");
        }
        toast.success(hub.is_active ? "Hub deactivated" : "Hub reactivated");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update");
      }
    });
  }, [hub.id, hub.name, hub.is_active, router]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "general", label: "General" },
    { key: "scoping", label: "Teams & Scoping" },
    { key: "danger", label: "Danger Zone" },
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold mb-1">{hub.name}</h1>
      <p className="text-sm text-muted-foreground mb-6">
        /{hub.slug}
      </p>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* General tab */}
      {tab === "general" && (
        <div className="space-y-6">
          <div>
            <label htmlFor="hub-name" className="block text-sm font-medium mb-1.5">
              Hub Name
            </label>
            <input
              id="hub-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={saveGeneral}
              disabled={!dirty || !name.trim() || isPending}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                dirty && name.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isPending ? "Saving..." : "Save Changes"}
            </button>
            {dirty && (
              <span className="text-xs text-muted-foreground">Unsaved changes</span>
            )}
          </div>
        </div>
      )}

      {/* Scoping tab */}
      {tab === "scoping" && (
        <ScopingEditor hubId={hub.id} mappings={mappings} />
      )}

      {/* Danger zone tab */}
      {tab === "danger" && (
        <div className="border border-destructive/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium">
                {hub.is_active ? "Deactivate Hub" : "Reactivate Hub"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                {hub.is_active
                  ? "Deactivating will hide this hub from all client users. No data is deleted."
                  : "Reactivating will make this hub visible to client users again."}
              </p>
              <button
                onClick={deactivateHub}
                disabled={isPending}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  hub.is_active
                    ? "bg-destructive text-white hover:bg-destructive/90"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {isPending
                  ? "Updating..."
                  : hub.is_active
                    ? "Deactivate Hub"
                    : "Reactivate Hub"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
