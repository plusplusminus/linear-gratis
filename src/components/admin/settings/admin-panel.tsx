"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { captureEvent } from "@/lib/posthog-client";
import { POSTHOG_EVENTS } from "@/lib/posthog-events";
import { Shield, Trash2 } from "lucide-react";

interface PPMAdmin {
  id: string;
  email: string;
  status: "active" | "pending";
  created_at: string;
}

interface AdminPanelProps {
  currentUserEmail: string;
}

export function AdminPanel({ currentUserEmail }: AdminPanelProps) {
  const [admins, setAdmins] = useState<PPMAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");

  const fetchAdmins = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings/admins");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: PPMAdmin[] = await res.json();
      setAdmins(data);
    } catch {
      toast.error("Failed to load admins");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  function addAdmin(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/settings/admins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: trimmed }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Failed to add admin");
        }
        toast.success(`Added ${trimmed} as admin`);
        captureEvent(POSTHOG_EVENTS.admin_added);
        setEmail("");
        await fetchAdmins();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to add admin");
      }
    });
  }

  function removeAdmin(admin: PPMAdmin) {
    if (!confirm(`Remove ${admin.email} as an admin?`)) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/settings/admins/${admin.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Failed to remove admin");
        }
        toast.success(`Removed ${admin.email}`);
        captureEvent(POSTHOG_EVENTS.admin_removed);
        await fetchAdmins();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to remove admin");
      }
    });
  }

  const isCurrentUser = (adminEmail: string) =>
    adminEmail.toLowerCase() === currentUserEmail.toLowerCase();

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Admins</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {loading
            ? "Loading..."
            : `${admins.length} admin${admins.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Add admin form */}
      <form onSubmit={addAdmin} className="flex gap-2 mb-6">
        <label htmlFor="admin-email" className="sr-only">
          Admin email address
        </label>
        <input
          id="admin-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          disabled={isPending}
          className="flex-1 h-9 px-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={isPending || !email.trim().includes("@")}
          className="h-9 px-4 text-sm font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          Add admin
        </button>
      </form>

      {/* Admin list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : admins.length === 0 ? (
        <div className="border border-border rounded-lg p-8 text-center">
          <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No admins configured.
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_80px] gap-2 px-4 py-2 bg-muted/30 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">
              Email
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              Status
            </span>
            <span className="text-xs font-medium text-muted-foreground text-right">
              Actions
            </span>
          </div>

          {/* Rows */}
          {admins.map((admin) => (
            <div
              key={admin.id}
              className="grid grid-cols-[1fr_80px_80px] gap-2 items-center px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors"
            >
              {/* Email */}
              <div className="min-w-0">
                <p className="text-sm truncate">
                  {admin.email}
                  {isCurrentUser(admin.email) && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground">
                      (you)
                    </span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(admin.created_at).toLocaleDateString()}
                </p>
              </div>

              {/* Status */}
              <div>
                <span
                  className={cn(
                    "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                    admin.status === "active"
                      ? "bg-[var(--badge-green-bg)] text-[var(--badge-green-text)]"
                      : "bg-[var(--badge-yellow-bg)] text-[var(--badge-yellow-text)]"
                  )}
                >
                  {admin.status === "active" ? "Active" : "Pending"}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end">
                {!isCurrentUser(admin.email) && (
                  <button
                    onClick={() => removeAdmin(admin)}
                    disabled={isPending}
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label={`Remove ${admin.email}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
