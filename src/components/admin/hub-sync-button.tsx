"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface HubSyncButtonProps {
  hubId: string;
}

export function HubSyncButton({ hubId }: HubSyncButtonProps) {
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/admin/hubs/${hubId}/sync`, {
        method: "POST",
      });

      const data = (await res.json()) as {
        success?: boolean;
        teamCount?: number;
        teamResults?: Array<{
          teamName: string;
          issueCount: number;
          commentCount: number;
          projectCount: number;
        }>;
        error?: string;
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Sync failed");
      }

      const totalIssues =
        data.teamResults?.reduce((sum, t) => sum + t.issueCount, 0) ?? 0;
      const totalComments =
        data.teamResults?.reduce((sum, t) => sum + t.commentCount, 0) ?? 0;

      toast.success(
        `Synced ${totalIssues} issues, ${totalComments} comments across ${data.teamCount} teams`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="border border-border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors group text-left w-full disabled:opacity-50"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-muted-foreground group-hover:text-primary transition-colors">
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
        </span>
        <span className="text-sm font-medium group-hover:text-primary transition-colors">
          {syncing ? "Syncing..." : "Sync Data"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Pull latest issues and comments from Linear
      </p>
    </button>
  );
}
