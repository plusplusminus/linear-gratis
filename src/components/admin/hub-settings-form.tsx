"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useFetch } from "@/hooks/use-fetch";
import { ScopingEditor } from "./scoping-editor";
import { AlertTriangle, Globe, Loader2, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import type { FormTemplate, FormField, HubFormConfig } from "@/lib/supabase";

interface TeamMapping {
  id: string;
  linear_team_id: string;
  linear_team_name: string | null;
  visible_project_ids: string[];
  visible_initiative_ids: string[];
  visible_label_ids: string[];
  hidden_label_ids: string[];
  is_active: boolean;
}

interface HubSettingsFormProps {
  hub: {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
    request_forms_enabled: boolean;
  };
  mappings: TeamMapping[];
}

type Tab = "general" | "scoping" | "forms" | "domain" | "danger";

type FormWithFields = FormTemplate & { fields: FormField[] };

export function HubSettingsForm({ hub, mappings }: HubSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("general");

  // General state
  const [name, setName] = useState(hub.name);
  const [requestFormsEnabled, setRequestFormsEnabled] = useState(hub.request_forms_enabled);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDirty(
      name !== hub.name ||
      requestFormsEnabled !== hub.request_forms_enabled
    );
  }, [name, hub.name, requestFormsEnabled, hub.request_forms_enabled]);

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
          body: JSON.stringify({
            name: name.trim(),
            request_forms_enabled: requestFormsEnabled,
          }),
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
  }, [hub.id, name, requestFormsEnabled, router]);

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

  // Custom domain state
  const [domainInput, setDomainInput] = useState("");
  const [currentDomain, setCurrentDomain] = useState<{
    id: string;
    domain: string;
    verification_status: string;
  } | null>(null);
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainFetched, setDomainFetched] = useState(false);

  const fetchDomain = useCallback(async () => {
    setDomainLoading(true);
    try {
      const res = await fetch(`/api/admin/hubs/${hub.id}/domain`);
      if (res.ok) {
        const data = (await res.json()) as { domain: { id: string; domain: string; verification_status: string } | null };
        setCurrentDomain(data.domain);
        if (data.domain) setDomainInput(data.domain.domain);
      }
    } catch {
      // ignore
    } finally {
      setDomainLoading(false);
      setDomainFetched(true);
    }
  }, [hub.id]);

  // Fetch domain when switching to domain tab
  useEffect(() => {
    if (tab === "domain" && !domainFetched) {
      fetchDomain();
    }
  }, [tab, domainFetched, fetchDomain]);

  const saveDomain = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/hubs/${hub.id}/domain`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: domainInput.trim() }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Failed to save domain");
        }
        const data = (await res.json()) as { domain: { id: string; domain: string; verification_status: string } };
        setCurrentDomain(data.domain);
        toast.success("Custom domain saved");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save domain");
      }
    });
  }, [hub.id, domainInput]);

  const removeDomain = useCallback(() => {
    if (!confirm("Remove the custom domain from this hub?")) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/hubs/${hub.id}/domain`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Failed to remove domain");
        }
        setCurrentDomain(null);
        setDomainInput("");
        toast.success("Custom domain removed");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to remove domain");
      }
    });
  }, [hub.id]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "general", label: "General" },
    { key: "scoping", label: "Teams & Scoping" },
    { key: "forms", label: "Forms" },
    { key: "domain", label: "Custom Domain" },
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

          {/* Request forms toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">Customer Request Forms</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Allow hub members to submit requests via Linear&apos;s customer needs.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={requestFormsEnabled}
              onClick={() => setRequestFormsEnabled(!requestFormsEnabled)}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                requestFormsEnabled ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
                  requestFormsEnabled ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
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

      {/* Forms tab */}
      {tab === "forms" && (
        <HubFormsTab hubId={hub.id} />
      )}

      {/* Custom domain tab */}
      {tab === "domain" && (
        <div className="space-y-6">
          {domainLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading domain settings...
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="custom-domain"
                  className="block text-sm font-medium mb-1.5"
                >
                  Custom Domain
                </label>
                <p className="text-xs text-muted-foreground mb-3">
                  Point a custom domain to this hub so clients can access it at
                  their own URL.
                </p>
                <div className="flex gap-2">
                  <input
                    id="custom-domain"
                    type="text"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    placeholder="hub.example.com"
                    className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                  <button
                    onClick={saveDomain}
                    disabled={
                      !domainInput.trim() ||
                      domainInput.trim() === currentDomain?.domain ||
                      isPending
                    }
                    className={cn(
                      "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                      domainInput.trim() &&
                        domainInput.trim() !== currentDomain?.domain
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    {isPending ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>

              {currentDomain && (
                <div className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {currentDomain.domain}
                      </span>
                      <span
                        className={cn(
                          "px-1.5 py-0.5 text-xs rounded-full font-medium",
                          currentDomain.verification_status === "verified"
                            ? "bg-green-500/10 text-green-500"
                            : currentDomain.verification_status === "failed"
                              ? "bg-red-500/10 text-red-500"
                              : "bg-yellow-500/10 text-yellow-500"
                        )}
                      >
                        {currentDomain.verification_status}
                      </span>
                    </div>
                    <button
                      onClick={removeDomain}
                      disabled={isPending}
                      className="p-1.5 text-muted-foreground hover:text-destructive rounded-md transition-colors"
                      title="Remove domain"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="bg-muted/50 rounded-md p-3">
                    <h4 className="text-xs font-medium mb-2">DNS Setup</h4>
                    <p className="text-xs text-muted-foreground mb-2">
                      Add the following CNAME record to your DNS provider:
                    </p>
                    <div className="font-mono text-xs bg-background border border-border rounded px-2 py-1.5 select-all">
                      {"CNAME"} {currentDomain.domain} {"\u2192"}{" "}
                      {"cname.vercel-dns.com"}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      After adding the record, add{" "}
                      <span className="font-medium">
                        {currentDomain.domain}
                      </span>{" "}
                      as a domain in your Vercel project settings for SSL to be
                      provisioned automatically.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
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

// ============================================================
// Hub Forms Tab
// ============================================================

const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  bug: { bg: "var(--badge-orange-bg)", text: "var(--badge-orange-text)", label: "Bug" },
  feature: { bg: "var(--badge-blue-bg)", text: "var(--badge-blue-text)", label: "Feature" },
  custom: { bg: "var(--badge-gray-bg)", text: "var(--badge-gray-text)", label: "Custom" },
};

const PRIORITY_OPTIONS = [
  { value: "", label: "Inherit default" },
  { value: "0", label: "No priority" },
  { value: "1", label: "Urgent" },
  { value: "2", label: "High" },
  { value: "3", label: "Medium" },
  { value: "4", label: "Low" },
];

const inputClass =
  "w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent";

type HubFormsApiResponse = {
  global_forms: Array<FormTemplate & { hub_config: HubFormConfig | null }>;
  hub_forms: FormTemplate[];
};

function HubFormsTab({ hubId }: { hubId: string }) {
  const [isPending, startTransition] = useTransition();
  const { data: globalForms, loading: formsLoading } =
    useFetch<FormWithFields[]>("/api/admin/forms");
  const { data: hubFormsData, loading: configsLoading, refetch: refetchConfigs } =
    useFetch<HubFormsApiResponse>(`/api/admin/hubs/${hubId}/forms`);
  const [expandedForm, setExpandedForm] = useState<string | null>(null);

  // Override state per form
  const [overrides, setOverrides] = useState<
    Record<string, Partial<HubFormConfig>>
  >({});

  // Seed overrides from fetched hub form configs
  useEffect(() => {
    if (hubFormsData?.global_forms) {
      const map: Record<string, Partial<HubFormConfig>> = {};
      for (const gf of hubFormsData.global_forms) {
        if (gf.hub_config) {
          map[gf.id] = {
            is_enabled: gf.hub_config.is_enabled,
            target_team_id: gf.hub_config.target_team_id,
            target_project_id: gf.hub_config.target_project_id,
            target_cycle_id: gf.hub_config.target_cycle_id,
            target_label_ids: gf.hub_config.target_label_ids,
            target_priority: gf.hub_config.target_priority,
            confirmation_message: gf.hub_config.confirmation_message,
          };
        }
      }
      setOverrides(map);
    }
  }, [hubFormsData]);

  const getOverride = (formId: string) =>
    overrides[formId] ?? {};

  const isEnabled = (formId: string) =>
    getOverride(formId).is_enabled ?? false;

  const toggleEnabled = (formId: string) => {
    const current = isEnabled(formId);
    const newEnabled = !current;

    setOverrides((prev) => ({
      ...prev,
      [formId]: { ...prev[formId], is_enabled: newEnabled },
    }));

    // Save immediately
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/hubs/${hubId}/forms/${formId}/config`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ is_enabled: newEnabled }),
          }
        );
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Failed to update");
        }
        toast.success(
          newEnabled ? "Form enabled for hub" : "Form disabled for hub"
        );
        refetchConfigs();
      } catch (e) {
        // Revert
        setOverrides((prev) => ({
          ...prev,
          [formId]: { ...prev[formId], is_enabled: current },
        }));
        toast.error(e instanceof Error ? e.message : "Failed to update");
      }
    });
  };

  const saveOverrides = (formId: string) => {
    const ovr = getOverride(formId);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/hubs/${hubId}/forms/${formId}/config`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target_team_id: ovr.target_team_id || null,
              target_project_id: ovr.target_project_id || null,
              target_cycle_id: ovr.target_cycle_id || null,
              target_label_ids: ovr.target_label_ids ?? null,
              target_priority:
                ovr.target_priority !== undefined && ovr.target_priority !== null
                  ? ovr.target_priority
                  : null,
              confirmation_message: ovr.confirmation_message || null,
            }),
          }
        );
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Failed to save overrides");
        }
        toast.success("Overrides saved");
        refetchConfigs();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save");
      }
    });
  };

  const updateOverride = (
    formId: string,
    patch: Partial<HubFormConfig>
  ) => {
    setOverrides((prev) => ({
      ...prev,
      [formId]: { ...prev[formId], ...patch },
    }));
  };

  const loading = formsLoading || configsLoading;
  const forms = globalForms ?? [];

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading forms...
        </div>
      ) : forms.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-6">
          No global forms created yet.{" "}
          <Link
            href="/admin/forms/new"
            className="text-primary hover:underline"
          >
            Create one
          </Link>
        </div>
      ) : (
        <>
          <div>
            <h3 className="text-sm font-semibold mb-3">Global Forms</h3>
            <div className="border border-border rounded-lg bg-card overflow-hidden">
              {forms.map((form, i) => {
                const badge = TYPE_BADGE[form.type] ?? TYPE_BADGE.custom;
                const enabled = isEnabled(form.id);
                const isExpanded = expandedForm === form.id;
                const ovr = getOverride(form.id);

                return (
                  <div
                    key={form.id}
                    className={cn(
                      i < forms.length - 1 && "border-b border-border"
                    )}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Enable toggle */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        onClick={() => toggleEnabled(form.id)}
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                          enabled ? "bg-primary" : "bg-muted"
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
                            enabled ? "translate-x-4" : "translate-x-0"
                          )}
                        />
                      </button>

                      {/* Form name + type */}
                      <span className="text-sm font-medium flex-1 truncate">
                        {form.name}
                      </span>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
                        style={{
                          backgroundColor: badge.bg,
                          color: badge.text,
                        }}
                      >
                        {badge.label}
                      </span>

                      {/* Expand overrides */}
                      <button
                        onClick={() =>
                          setExpandedForm(isExpanded ? null : form.id)
                        }
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                        title="Routing overrides"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Override panel */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-border/50 bg-muted/20">
                        <p className="text-xs text-muted-foreground pt-3">
                          Override routing for this hub. Leave blank to use form defaults.
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Team Override
                            </label>
                            <input
                              type="text"
                              value={ovr.target_team_id ?? ""}
                              onChange={(e) =>
                                updateOverride(form.id, {
                                  target_team_id: e.target.value || null,
                                })
                              }
                              placeholder="Team ID"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Project Override
                            </label>
                            <input
                              type="text"
                              value={ovr.target_project_id ?? ""}
                              onChange={(e) =>
                                updateOverride(form.id, {
                                  target_project_id: e.target.value || null,
                                })
                              }
                              placeholder="Project ID"
                              className={inputClass}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Cycle Override
                            </label>
                            <input
                              type="text"
                              value={ovr.target_cycle_id ?? ""}
                              onChange={(e) =>
                                updateOverride(form.id, {
                                  target_cycle_id: e.target.value || null,
                                })
                              }
                              placeholder="Cycle ID"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">
                              Priority Override
                            </label>
                            <select
                              value={
                                ovr.target_priority !== undefined &&
                                ovr.target_priority !== null
                                  ? String(ovr.target_priority)
                                  : ""
                              }
                              onChange={(e) =>
                                updateOverride(form.id, {
                                  target_priority: e.target.value
                                    ? parseInt(e.target.value, 10)
                                    : null,
                                })
                              }
                              className={inputClass}
                            >
                              {PRIORITY_OPTIONS.map((p) => (
                                <option key={p.value} value={p.value}>
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium mb-1">
                            Confirmation Message Override
                          </label>
                          <textarea
                            value={ovr.confirmation_message ?? ""}
                            onChange={(e) =>
                              updateOverride(form.id, {
                                confirmation_message: e.target.value || null,
                              })
                            }
                            placeholder="Leave blank for form default"
                            rows={2}
                            className={inputClass}
                          />
                        </div>

                        <button
                          onClick={() => saveOverrides(form.id)}
                          disabled={isPending}
                          className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          {isPending ? "Saving..." : "Save Overrides"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
