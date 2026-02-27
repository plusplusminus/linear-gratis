"use client";

import { cn } from "@/lib/utils";
import type { HubMember } from "./member-panel";
import { RotateCcw, Trash2 } from "lucide-react";

interface MemberListProps {
  members: HubMember[];
  onResend: (member: HubMember) => void;
  onChangeRole: (member: HubMember, role: "default" | "view_only") => void;
  onRemove: (member: HubMember) => void;
  isPending: boolean;
}

export function MemberList({
  members,
  onResend,
  onChangeRole,
  onRemove,
  isPending,
}: MemberListProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_100px_80px_80px] gap-2 px-4 py-2 bg-muted/30 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">Email</span>
        <span className="text-xs font-medium text-muted-foreground">Role</span>
        <span className="text-xs font-medium text-muted-foreground">Status</span>
        <span className="text-xs font-medium text-muted-foreground text-right">Actions</span>
      </div>

      {/* Rows */}
      {members.map((member) => (
        <div
          key={member.id}
          className="grid grid-cols-[1fr_100px_80px_80px] gap-2 items-center px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors"
        >
          {/* Email */}
          <div className="min-w-0">
            <p className="text-sm truncate">{member.email}</p>
            {member.created_at && (
              <p className="text-[10px] text-muted-foreground">
                {new Date(member.created_at).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Role */}
          <div>
            <select
              value={member.role}
              onChange={(e) =>
                onChangeRole(member, e.target.value as "default" | "view_only")
              }
              disabled={isPending}
              className="text-xs px-1.5 py-0.5 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="default">Full access</option>
              <option value="view_only">View only</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <span
              className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                member.status === "active"
                  ? "bg-[var(--badge-green-bg)] text-[var(--badge-green-text)]"
                  : "bg-[var(--badge-yellow-bg)] text-[var(--badge-yellow-text)]"
              )}
            >
              {member.status === "active" ? "Active" : "Invited"}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-1">
            {member.status === "invited" && (
              <button
                onClick={() => onResend(member)}
                disabled={isPending}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                title="Resend invite"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => onRemove(member)}
              disabled={isPending}
              className="p-1 text-muted-foreground hover:text-destructive transition-colors"
              title="Remove member"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
