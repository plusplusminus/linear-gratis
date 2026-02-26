"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Check, Unplug, RefreshCw, AlertCircle, Zap } from "lucide-react";

interface TokenStatus {
  configured: boolean;
  viewer?: { name: string | null; email: string | null };
  connectedAt?: string | null;
}

export function TokenConnectionForm() {
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetchStatus();
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch("/api/admin/workspace/token");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: TokenStatus = await res.json();
      setStatus(data);
    } catch {
      setStatus({ configured: false });
    } finally {
      setLoading(false);
    }
  }

  function connect() {
    if (!token.trim()) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/workspace/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: token.trim() }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Failed to connect");
        }
        toast.success("Linear API token connected");
        setToken("");
        await fetchStatus();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to connect");
      }
    });
  }

  function disconnect() {
    if (!confirm("Disconnect the Linear API token? Sync and entity pickers will stop working until reconnected.")) {
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/workspace/token", {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to disconnect");
        toast.success("Linear API token disconnected");
        setToken("");
        await fetchStatus();
      } catch {
        toast.error("Failed to disconnect");
      }
    });
  }

  if (loading) {
    return (
      <div className="max-w-lg">
        <h1 className="text-xl font-semibold mb-6">Linear Connection</h1>
        <div className="h-32 rounded-lg bg-muted/50 animate-pulse" />
      </div>
    );
  }

  const connected = status?.configured ?? false;

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-1">Linear Connection</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Connect your Linear workspace API token to enable team sync, entity pickers, and label fetching.
      </p>

      {connected ? (
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
                  {status?.viewer?.name ?? status?.viewer?.email ?? "Linear workspace"}
                </p>
              </div>
            </div>

            {status?.connectedAt && (
              <p className="text-xs text-muted-foreground">
                Connected {new Date(status.connectedAt).toLocaleDateString()} at{" "}
                {new Date(status.connectedAt).toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Rotate token */}
          <div className="border border-border rounded-lg p-4 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm font-medium">Rotate Token</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Replace the current token with a new one. The old token will be discarded.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="lin_api_..."
                className="flex-1 px-3 py-2 text-sm border border-border rounded-md bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent placeholder:text-muted-foreground/60"
              />
              <button
                onClick={connect}
                disabled={!token.trim() || isPending}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                  token.trim()
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                {isPending ? "Validating..." : "Rotate"}
              </button>
            </div>
          </div>

          {/* Disconnect */}
          <div className="border border-destructive/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Unplug className="w-4 h-4 text-destructive" />
              <p className="text-sm font-medium">Disconnect</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Remove the token entirely. All sync and entity pickers will stop working.
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
        /* Disconnected state */
        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <Zap className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Not connected</p>
              <p className="text-xs text-muted-foreground">
                Enter your Linear API token to get started
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="token" className="block text-xs font-medium mb-1">
                API Token
              </label>
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="lin_api_..."
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent placeholder:text-muted-foreground/60"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Get your token from Linear Settings → API → Personal API keys
              </p>
            </div>

            <button
              onClick={connect}
              disabled={!token.trim() || isPending}
              className={cn(
                "w-full px-4 py-2 text-sm font-medium rounded-md transition-colors",
                token.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isPending ? "Validating..." : "Connect"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
