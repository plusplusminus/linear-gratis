"use client";

import { useState, useCallback } from "react";
import { useHub } from "@/contexts/hub-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Project = {
  id: string;
  name: string;
};

export function RequestFormModal({
  projects,
  onClose,
}: {
  projects: Project[];
  onClose: () => void;
}) {
  const { hubId, email, firstName, lastName } = useHub();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetProjectId, setTargetProjectId] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") || email;

  const canSubmit = title.trim() && targetProjectId && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/hub/${hubId}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          targetProjectId,
          ...(attachmentUrl.trim() && { attachmentUrl: attachmentUrl.trim() }),
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to submit request");
      }

      toast.success("Request submitted");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, hubId, title, description, targetProjectId, attachmentUrl, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-lg border border-border bg-background shadow-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">
            Submit a Request
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Identity (read-only) */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Submitting as
            </label>
            <div className="text-sm text-foreground">
              {displayName}
              {displayName !== email && (
                <span className="text-muted-foreground ml-1.5">
                  ({email})
                </span>
              )}
            </div>
          </div>

          {/* Project */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Project
            </label>
            <Select value={targetProjectId} onValueChange={setTargetProjectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of your request"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide additional details..."
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Attachment URL */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Attachment URL
              <span className="text-muted-foreground/60 font-normal ml-1">
                (optional)
              </span>
            </label>
            <Input
              type="url"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Submit Request
          </Button>
        </div>
      </div>
    </div>
  );
}
