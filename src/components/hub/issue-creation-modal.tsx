"use client";

import { useState, useRef, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useHub } from "@/contexts/hub-context";

type Label = { id: string; name: string; color: string };

interface HubIssueCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (issue: CreatedIssueData) => void;
  teamId: string;
  projectId: string;
  labels: Label[];
}

export type CreatedIssueData = {
  id: string;
  identifier: string;
  title: string;
  priority: number;
  priorityLabel: string;
  state: { id: string; name: string; color: string; type: string };
  labels: Label[];
  createdAt: string;
};

const PRIORITIES = [
  { value: 0, label: "No priority" },
  { value: 1, label: "Urgent" },
  { value: 2, label: "High" },
  { value: 3, label: "Medium" },
  { value: 4, label: "Low" },
] as const;

export function HubIssueCreationModal({
  isOpen,
  onClose,
  onCreated,
  teamId,
  projectId,
  labels,
}: HubIssueCreationModalProps) {
  const { hubId } = useHub();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(0);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPriority, setShowPriority] = useState(false);
  const [showLabels, setShowLabels] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const priorityRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset form
      setTitle("");
      setDescription("");
      setPriority(0);
      setSelectedLabelIds([]);
      setError(null);
      setIsSubmitting(false);
      setTimeout(() => titleRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      if (showPriority && priorityRef.current && !priorityRef.current.contains(t)) {
        setShowPriority(false);
      }
      if (showLabels && labelsRef.current && !labelsRef.current.contains(t)) {
        setShowLabels(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, showPriority, showLabels]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/hub/${hubId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          priority: priority || undefined,
          labelIds: selectedLabelIds.length > 0 ? selectedLabelIds : undefined,
          teamId,
          projectId,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Failed to create issue");
      }

      const data = (await res.json()) as { issue: CreatedIssueData };
      onCreated(data.issue);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create issue");
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleLabel(id: string) {
    setSelectedLabelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const selectedPriority = PRIORITIES.find((p) => p.value === priority)!;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-[51] w-full max-w-[640px] mx-4 bg-background border border-border rounded-lg shadow-2xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-xs text-muted-foreground font-medium">
              New Issue
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-2 border-b border-border">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {/* Title + Description */}
          <div className="px-4 pt-4 pb-2">
            <input
              ref={titleRef}
              type="text"
              placeholder="Issue title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError(null);
              }}
              className="w-full bg-transparent text-base font-medium placeholder:text-muted-foreground/50 outline-none"
            />
          </div>
          <div className="px-4 pb-4">
            <textarea
              placeholder="Add description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-transparent text-sm placeholder:text-muted-foreground/50 outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Properties bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-border flex-wrap">
            {/* Priority dropdown */}
            <div className="relative" ref={priorityRef}>
              <button
                type="button"
                onClick={() => {
                  setShowPriority(!showPriority);
                  setShowLabels(false);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors border border-border",
                  "hover:bg-accent text-muted-foreground hover:text-foreground"
                )}
              >
                <PriorityBar priority={priority} />
                {selectedPriority.label}
              </button>

              {showPriority && (
                <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 min-w-[150px] py-1">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => {
                        setPriority(p.value);
                        setShowPriority(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors",
                        priority === p.value && "bg-accent"
                      )}
                    >
                      <PriorityBar priority={p.value} />
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Labels dropdown */}
            {labels.length > 0 && (
              <div className="relative" ref={labelsRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowLabels(!showLabels);
                    setShowPriority(false);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-colors border border-border",
                    "hover:bg-accent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {selectedLabelIds.length > 0 ? (
                    <>
                      <div className="flex gap-0.5">
                        {selectedLabelIds.slice(0, 3).map((id) => {
                          const label = labels.find((l) => l.id === id);
                          return label ? (
                            <div
                              key={id}
                              className="w-2.5 h-2.5 rounded-sm"
                              style={{ backgroundColor: label.color }}
                            />
                          ) : null;
                        })}
                      </div>
                      {selectedLabelIds.length === 1
                        ? labels.find((l) => l.id === selectedLabelIds[0])?.name
                        : `${selectedLabelIds.length} labels`}
                    </>
                  ) : (
                    "Label"
                  )}
                </button>

                {showLabels && (
                  <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 min-w-[180px] max-h-48 overflow-y-auto py-1">
                    {labels.map((label) => {
                      const isSelected = selectedLabelIds.includes(label.id);
                      return (
                        <button
                          key={label.id}
                          type="button"
                          onClick={() => toggleLabel(label.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors",
                            isSelected && "bg-accent/50"
                          )}
                        >
                          <div
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: label.color }}
                          />
                          <span className="flex-1 truncate">{label.name}</span>
                          {isSelected && (
                            <span className="text-foreground text-[10px]">
                              &#10003;
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!title.trim() || isSubmitting}
              className="text-xs"
            >
              {isSubmitting ? "Creating..." : "Create issue"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PriorityBar({ priority }: { priority: number }) {
  const bars = [1, 2, 3];
  const filled =
    priority === 0 ? 0 : priority === 1 ? 3 : priority === 2 ? 3 : priority === 3 ? 2 : 1;
  const color =
    priority === 1
      ? "bg-orange-500"
      : priority === 2
        ? "bg-orange-400"
        : priority === 3
          ? "bg-yellow-500"
          : priority === 4
            ? "bg-blue-400"
            : "bg-muted-foreground/40";

  return (
    <div className="flex items-end gap-px h-3">
      {bars.map((bar) => (
        <div
          key={bar}
          className={cn(
            "w-[3px] rounded-[0.5px]",
            bar <= filled ? color : "bg-muted-foreground/20"
          )}
          style={{ height: `${bar * 4}px` }}
        />
      ))}
    </div>
  );
}
