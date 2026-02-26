"use client";

import { useState } from "react";
import { Search, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PickerShellProps {
  label: string;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  empty?: boolean;
  emptyMessage?: string;
  searchPlaceholder?: string;
  children: (filter: string) => React.ReactNode;
}

export function PickerShell({
  label,
  loading,
  error,
  onRetry,
  empty,
  emptyMessage,
  searchPlaceholder,
  children,
}: PickerShellProps) {
  const [filter, setFilter] = useState("");

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="px-3 py-2 border-b border-border bg-muted/30">
        <p className="text-xs font-medium text-foreground">{label}</p>
      </div>

      <div className="px-2 py-1.5 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={searchPlaceholder ?? `Filter ${label.toLowerCase()}...`}
            className="w-full pl-7 pr-2 py-1.5 text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      <div className="max-h-60 overflow-y-auto">
        {loading ? (
          <div className="px-3 py-2 space-y-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-7 rounded bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="px-3 py-4 text-center">
            <AlertCircle className="w-4 h-4 text-destructive mx-auto mb-1.5" />
            <p className="text-xs text-destructive mb-2">{error}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
          </div>
        ) : empty ? (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-muted-foreground">
              {emptyMessage ?? "No items found"}
            </p>
          </div>
        ) : (
          children(filter)
        )}
      </div>
    </div>
  );
}

interface PickerItemProps {
  selected: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}

export function PickerItem({
  selected,
  onToggle,
  children,
  className,
}: PickerItemProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-left transition-colors",
        selected
          ? "bg-accent/70 text-foreground"
          : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
        className
      )}
    >
      <div
        className={cn(
          "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
          selected
            ? "bg-primary border-primary"
            : "border-border"
        )}
      >
        {selected && (
          <svg
            viewBox="0 0 12 12"
            className="w-2.5 h-2.5 text-primary-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
      </div>
      {children}
    </button>
  );
}
