"use client";

import { useState, useRef, useEffect } from "react";
import { X, Plus, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Label = { id: string; name: string; color: string };

export function LabelEditor({
  issueLabels,
  hubLabels,
  hubId,
  issueId,
  isViewOnly,
  onLabelsChange,
}: {
  issueLabels: Label[];
  hubLabels: Label[];
  hubId: string;
  issueId: string;
  isViewOnly?: boolean;
  onLabelsChange: (labels: Label[]) => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Available labels = hub labels not already on the issue
  const issueIds = new Set(issueLabels.map((l) => l.id));
  const available = hubLabels
    .filter((l) => !issueIds.has(l.id))
    .filter(
      (l) =>
        !search || l.name.toLowerCase().includes(search.toLowerCase())
    );

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  async function handleAdd(label: Label) {
    setPendingAction(label.id);

    // Optimistic
    const optimistic = [...issueLabels, label];
    onLabelsChange(optimistic);

    try {
      const res = await fetch(`/api/hub/${hubId}/issues/${issueId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", labelId: label.id }),
      });

      if (!res.ok) {
        // Revert
        onLabelsChange(issueLabels);
      } else {
        const data = (await res.json()) as { labels: Label[] };
        onLabelsChange(data.labels);
      }
    } catch {
      onLabelsChange(issueLabels);
    } finally {
      setPendingAction(null);
      setDropdownOpen(false);
      setSearch("");
    }
  }

  async function handleRemove(labelId: string) {
    setPendingAction(labelId);

    // Optimistic
    const optimistic = issueLabels.filter((l) => l.id !== labelId);
    onLabelsChange(optimistic);

    try {
      const res = await fetch(`/api/hub/${hubId}/issues/${issueId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", labelId }),
      });

      if (!res.ok) {
        // Revert
        onLabelsChange(issueLabels);
      } else {
        const data = (await res.json()) as { labels: Label[] };
        onLabelsChange(data.labels);
      }
    } catch {
      onLabelsChange(issueLabels);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex flex-wrap items-center gap-1.5">
        {issueLabels.map((label) => (
          <span
            key={label.id}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-white/90 group/chip",
              pendingAction === label.id && "opacity-50"
            )}
            style={{ backgroundColor: label.color || "var(--muted)" }}
          >
            {label.name}
            {!isViewOnly && (
              <button
                onClick={() => handleRemove(label.id)}
                disabled={!!pendingAction}
                className="opacity-0 group-hover/chip:opacity-100 transition-opacity -mr-0.5 hover:text-white"
                title={`Remove ${label.name}`}
              >
                {pendingAction === label.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <X className="w-3 h-3" />
                )}
              </button>
            )}
          </span>
        ))}

        {/* Add label button */}
        {!isViewOnly && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              disabled={!!pendingAction}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>

            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-52 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                {/* Search */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                  <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter labels..."
                    className="flex-1 text-xs bg-transparent focus:outline-none placeholder:text-muted-foreground/60"
                    autoFocus
                  />
                </div>

                {/* Options */}
                <div className="max-h-48 overflow-y-auto py-1">
                  {available.length === 0 ? (
                    <p className="px-3 py-2 text-[11px] text-muted-foreground text-center">
                      {search ? "No matching labels" : "All labels applied"}
                    </p>
                  ) : (
                    available.map((label) => (
                      <button
                        key={label.id}
                        onClick={() => handleAdd(label)}
                        disabled={!!pendingAction}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent transition-colors"
                      >
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: label.color }}
                        />
                        <span className="truncate">{label.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Show placeholder if no labels and view-only */}
        {issueLabels.length === 0 && isViewOnly && (
          <span className="text-[11px] text-muted-foreground">No labels</span>
        )}
      </div>
    </div>
  );
}
