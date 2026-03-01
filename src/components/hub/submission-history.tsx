"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Loader2, FileText, Bug, Lightbulb } from "lucide-react";

type Submission = {
  id: string;
  derived_title: string | null;
  form_type: "bug" | "feature" | "custom";
  created_at: string;
  sync_status: "pending" | "synced" | "failed";
  linear_issue_identifier: string | null;
  linear_issue_state: string | null;
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const typeIcons = {
  bug: Bug,
  feature: Lightbulb,
  custom: FileText,
} as const;

export function SubmissionHistory({
  hubId,
  onClose,
}: {
  hubId: string;
  onClose: () => void;
}) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await fetch(`/api/hub/${hubId}/submissions`);
      if (!res.ok) return;
      const data = (await res.json()) as Submission[];
      setSubmissions(data);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [hubId]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleRetry = useCallback(
    async (id: string) => {
      setRetrying((prev) => new Set(prev).add(id));
      try {
        const res = await fetch(`/api/hub/${hubId}/submissions/${id}/retry`, {
          method: "POST",
        });
        if (res.ok) {
          await fetchSubmissions();
        }
      } catch {
        // Silent fail
      } finally {
        setRetrying((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [hubId, fetchSubmissions]
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm border-l border-border bg-background shadow-lg flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between h-12 px-4 border-b border-border shrink-0">
          <h2 className="text-sm font-semibold text-foreground">
            My Submissions
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              No submissions yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {submissions.map((sub) => {
                const Icon = typeIcons[sub.form_type] || FileText;
                return (
                  <div
                    key={sub.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {sub.derived_title || "Untitled"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {relativeTime(sub.created_at)}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      {sub.sync_status === "synced" && (
                        <Badge variant="green" className="text-[11px] px-1.5 py-0">
                          {sub.linear_issue_identifier}
                          {sub.linear_issue_state && ` \u00b7 ${sub.linear_issue_state}`}
                        </Badge>
                      )}
                      {sub.sync_status === "pending" && (
                        <Badge variant="yellow" className="text-[11px] px-1.5 py-0">
                          Pending
                        </Badge>
                      )}
                      {sub.sync_status === "failed" && (
                        <>
                          <Badge variant="red" className="text-[11px] px-1.5 py-0">
                            Failed
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            disabled={retrying.has(sub.id)}
                            onClick={() => handleRetry(sub.id)}
                          >
                            {retrying.has(sub.id) ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              "Retry"
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
