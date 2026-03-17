"use client";

import { useState, useEffect, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Check, Unplug, Users, ExternalLink } from "lucide-react";

interface OAuthStatus {
  envConfigured: boolean;
  authorized: boolean;
  app?: { name: string | null } | null;
  connectedAt?: string | null;
}

export function OAuthConnectionForm() {
  const [status, setStatus] = useState<OAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();

  useEffect(() => {
    fetchStatus();
  }, []);

  // Handle redirect results from OAuth callback
  useEffect(() => {
    if (searchParams.get("oauth_success") === "true") {
      toast.success("Linear OAuth app connected");
      // Clean URL without triggering navigation
      window.history.replaceState({}, "", "/admin/settings/linear");
      fetchStatus();
    }
    const oauthError = searchParams.get("oauth_error");
    if (oauthError) {
      const messages: Record<string, string> = {
        denied: "OAuth authorization was denied",
        missing_params: "Missing parameters from Linear callback",
        invalid_state: "Invalid state — please try again",
        exchange_failed: "Failed to exchange authorization code",
      };
      toast.error(messages[oauthError] ?? "OAuth connection failed");
      window.history.replaceState({}, "", "/admin/settings/linear");
    }
  }, [searchParams]);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/admin/workspace/oauth");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: OAuthStatus = await res.json();
      setStatus(data);
    } catch {
      setStatus({ envConfigured: false, authorized: false });
    } finally {
      setLoading(false);
    }
  }

  function connect() {
    // Navigate to the OAuth initiation endpoint — it redirects to Linear
    window.location.href = "/api/admin/workspace/oauth?action=connect";
  }

  function disconnect() {
    if (
      !confirm(
        "Disconnect the Linear OAuth app? Client comments will revert to showing the workspace token owner's name in Linear."
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/workspace/oauth", {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to disconnect");
        toast.success("Linear OAuth app disconnected");
        await fetchStatus();
      } catch {
        toast.error("Failed to disconnect");
      }
    });
  }

  if (loading) {
    return (
      <div className="max-w-lg">
        <h2 className="text-lg font-semibold mb-4">Comment Attribution</h2>
        <div className="h-32 rounded-lg bg-muted/50 animate-pulse" />
      </div>
    );
  }

  // Env vars not set — nothing to show except a note for developers
  if (!status?.envConfigured) {
    return (
      <div className="max-w-lg">
        <h2 className="text-lg font-semibold mb-1">Comment Attribution</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Connect a Linear OAuth app so client comments show the author&apos;s name
          in Linear instead of the workspace token owner.
        </p>
        <div className="border border-border rounded-lg p-4 bg-card">
          <p className="text-sm text-muted-foreground">
            OAuth app credentials are not configured. Set{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">
              LINEAR_OAUTH_CLIENT_ID
            </code>{" "}
            and{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">
              LINEAR_OAUTH_CLIENT_SECRET
            </code>{" "}
            environment variables to enable this feature.
          </p>
        </div>
      </div>
    );
  }

  const authorized = status?.authorized ?? false;

  return (
    <div className="max-w-lg">
      <h2 className="text-lg font-semibold mb-1">Comment Attribution</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Connect a Linear OAuth app so client comments show the author&apos;s name
        in Linear instead of the workspace token owner.
      </p>

      {authorized ? (
        <div className="space-y-4">
          {/* Connected state */}
          <div className="border border-border rounded-lg p-4 bg-card">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-full bg-[var(--badge-green-bg)] flex items-center justify-center">
                <Check className="w-4 h-4 text-[var(--badge-green-text)]" />
              </div>
              <div>
                <p className="text-sm font-medium">Connected</p>
                <p className="text-xs text-muted-foreground">
                  {status?.app?.name ?? "Linear OAuth App"}
                </p>
              </div>
            </div>

            {status?.connectedAt && (
              <p className="text-xs text-muted-foreground">
                Connected {new Date(status.connectedAt).toLocaleDateString()} at{" "}
                {new Date(status.connectedAt).toLocaleTimeString()}
              </p>
            )}

            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded px-2.5 py-1.5">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>
                Client comments appear as &ldquo;Author Name (via{" "}
                {status?.app?.name ?? "your app"})&rdquo; in Linear
              </span>
            </div>
          </div>

          {/* Disconnect */}
          <div className="border border-destructive/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Unplug className="w-4 h-4 text-destructive" />
              <p className="text-sm font-medium">Disconnect</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Client comments will revert to showing the workspace token
              owner&apos;s name in Linear.
            </p>
            <button
              onClick={disconnect}
              disabled={isPending}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-destructive text-white hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {isPending ? "Disconnecting..." : "Disconnect"}
            </button>
          </div>
        </div>
      ) : (
        /* Not connected — show Connect button */
        <div className="border border-[var(--badge-blue-bg)] bg-[var(--badge-blue-bg)]/10 rounded-lg p-6">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-[var(--badge-blue-bg)] flex items-center justify-center">
              <Users className="w-4 h-4 text-[var(--badge-blue-text)]" />
            </div>
            <div>
              <p className="text-sm font-medium">Not connected</p>
              <p className="text-xs text-muted-foreground">
                Authorize Pulse to post comments with client attribution
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-4">
            This will redirect you to Linear to authorize the Pulse OAuth app.
            Once authorized, client comments will show the author&apos;s name
            instead of the workspace token owner.
          </p>

          <button
            onClick={connect}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Connect to Linear
          </button>
        </div>
      )}
    </div>
  );
}
