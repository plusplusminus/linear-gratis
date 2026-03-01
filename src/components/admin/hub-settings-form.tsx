"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ScopingEditor } from "./scoping-editor";
import { AlertTriangle, Globe, Loader2, Trash2 } from "lucide-react";

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
    logo_url: string | null;
    primary_color: string | null;
    accent_color: string | null;
    footer_text: string | null;
    request_forms_enabled: boolean;
  };
  mappings: TeamMapping[];
}

type Tab = "general" | "scoping" | "branding" | "domain" | "danger";

export function HubSettingsForm({ hub, mappings }: HubSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("general");

  // General state
  const [name, setName] = useState(hub.name);
  const [requestFormsEnabled, setRequestFormsEnabled] = useState(hub.request_forms_enabled);
  const [dirty, setDirty] = useState(false);

  // Branding state
  const [logoUrl, setLogoUrl] = useState(hub.logo_url ?? "");
  const [primaryColor, setPrimaryColor] = useState(hub.primary_color ?? "");
  const [accentColor, setAccentColor] = useState(hub.accent_color ?? "");
  const [footerText, setFooterText] = useState(hub.footer_text ?? "");
  const [brandingDirty, setBrandingDirty] = useState(false);

  useEffect(() => {
    setBrandingDirty(
      logoUrl !== (hub.logo_url ?? "") ||
      primaryColor !== (hub.primary_color ?? "") ||
      accentColor !== (hub.accent_color ?? "") ||
      footerText !== (hub.footer_text ?? "")
    );
  }, [logoUrl, primaryColor, accentColor, footerText, hub.logo_url, hub.primary_color, hub.accent_color, hub.footer_text]);

  useEffect(() => {
    setDirty(
      name !== hub.name ||
      requestFormsEnabled !== hub.request_forms_enabled
    );
  }, [name, hub.name, requestFormsEnabled, hub.request_forms_enabled]);

  // Warn on navigation with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty || brandingDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, brandingDirty]);

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

  const saveBranding = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/hubs/${hub.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            logo_url: logoUrl.trim() || null,
            primary_color: primaryColor.trim() || null,
            accent_color: accentColor.trim() || null,
            footer_text: footerText.trim() || null,
          }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Failed to save");
        }
        toast.success("Branding saved");
        setBrandingDirty(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }, [hub.id, logoUrl, primaryColor, accentColor, footerText, router]);

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
    { key: "branding", label: "Branding" },
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

      {/* Branding tab */}
      {tab === "branding" && (
        <div className="space-y-6">
          {/* Live preview */}
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Preview</p>
            <div className="flex items-center gap-3 p-3 rounded-md bg-sidebar border border-border">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="h-6 w-auto object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="w-6 h-6 rounded bg-muted" />
              )}
              <span className="text-sm font-semibold">{hub.name}</span>
              <div className="ml-auto flex items-center gap-2">
                {primaryColor && (
                  <div
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: primaryColor }}
                  />
                )}
                {accentColor && (
                  <div
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: accentColor }}
                  />
                )}
              </div>
            </div>
            {footerText && (
              <p className="text-[10px] text-muted-foreground mt-2 text-center">{footerText}</p>
            )}
          </div>

          <div>
            <label htmlFor="logo-url" className="block text-sm font-medium mb-1.5">
              Logo URL
            </label>
            <input
              id="logo-url"
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.svg"
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Displayed in the sidebar header and login page.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="primary-color" className="block text-sm font-medium mb-1.5">
                Primary Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor || "#6366f1"}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
                />
                <input
                  id="primary-color"
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#6366f1"
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="accent-color" className="block text-sm font-medium mb-1.5">
                Accent Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor || "#8b5cf6"}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-8 h-8 rounded border border-border cursor-pointer bg-transparent"
                />
                <input
                  id="accent-color"
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  placeholder="#8b5cf6"
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="footer-text" className="block text-sm font-medium mb-1.5">
              Footer Text
            </label>
            <input
              id="footer-text"
              type="text"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="Powered by Acme Corp"
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={saveBranding}
              disabled={!brandingDirty || isPending}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                brandingDirty
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isPending ? "Saving..." : "Save Branding"}
            </button>
            {brandingDirty && (
              <span className="text-xs text-muted-foreground">Unsaved changes</span>
            )}
          </div>
        </div>
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
