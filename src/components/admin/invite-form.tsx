"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";

interface InviteFormProps {
  onInvite: (email: string, role: "default" | "view_only") => void;
  onBulkInvite: (emails: string[], role: "default" | "view_only") => void;
  isPending: boolean;
}

export function InviteForm({ onInvite, onBulkInvite, isPending }: InviteFormProps) {
  const [input, setInput] = useState("");
  const [role, setRole] = useState<"default" | "view_only">("default");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = input.trim();
    if (!raw) return;

    // Parse multiple emails (comma, semicolon, newline, space separated)
    const emails = raw
      .split(/[,;\n\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@"));

    if (emails.length === 0) return;

    if (emails.length === 1) {
      onInvite(emails[0], role);
    } else {
      onBulkInvite(emails, role);
    }

    setInput("");
  }

  const emailCount = input.trim()
    ? input.split(/[,;\n\s]+/).filter((e) => e.trim().includes("@")).length
    : 0;

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-lg p-4 bg-card">
      <div className="flex gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Email address (or paste multiple, comma-separated)"
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent placeholder:text-muted-foreground/60"
          />
        </div>

        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "default" | "view_only")}
          className="px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="default">Full access</option>
          <option value="view_only">View only</option>
        </select>

        <button
          type="submit"
          disabled={emailCount === 0 || isPending}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md transition-colors",
            emailCount > 0
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          <Send className="w-3.5 h-3.5" />
          {isPending ? "Sending..." : emailCount > 1 ? `Invite ${emailCount}` : "Invite"}
        </button>
      </div>

      {emailCount > 1 && (
        <p className="text-xs text-muted-foreground mt-1.5">
          {emailCount} emails detected — will send individual invites
        </p>
      )}
    </form>
  );
}
