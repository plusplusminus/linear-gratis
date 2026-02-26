"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { InviteForm } from "./invite-form";
import { MemberList } from "./member-list";
import { Users } from "lucide-react";

export interface HubMember {
  id: string;
  hub_id: string;
  user_id: string | null;
  email: string | null;
  role: "default" | "view_only";
  invited_by: string;
  workos_invitation_id: string | null;
  status: "active" | "invited";
  created_at: string;
}

interface MemberPanelProps {
  hubId: string;
  hubName: string;
}

export function MemberPanel({ hubId, hubName }: MemberPanelProps) {
  const [members, setMembers] = useState<HubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/hubs/${hubId}/members`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: HubMember[] = await res.json();
      setMembers(data);
    } catch {
      toast.error("Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [hubId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  function invite(email: string, role: "default" | "view_only") {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/hubs/${hubId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, role }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? "Failed to invite");
        }
        toast.success(`Invited ${email}`);
        await fetchMembers();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to invite");
      }
    });
  }

  function bulkInvite(emails: string[], role: "default" | "view_only") {
    startTransition(async () => {
      let success = 0;
      let failed = 0;
      for (const email of emails) {
        try {
          const res = await fetch(`/api/admin/hubs/${hubId}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, role }),
          });
          if (res.ok) success++;
          else failed++;
        } catch {
          failed++;
        }
      }
      if (success > 0) toast.success(`Invited ${success} user${success !== 1 ? "s" : ""}`);
      if (failed > 0) toast.error(`${failed} invite${failed !== 1 ? "s" : ""} failed`);
      await fetchMembers();
    });
  }

  function resendInvite(member: HubMember) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/hubs/${hubId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: member.email, role: member.role }),
        });
        if (!res.ok) throw new Error("Failed to resend");
        toast.success(`Invite resent to ${member.email}`);
      } catch {
        toast.error("Failed to resend invite");
      }
    });
  }

  function changeRole(member: HubMember, role: "default" | "view_only") {
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/hubs/${hubId}/members/${member.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role }),
          }
        );
        if (!res.ok) throw new Error("Failed to update role");
        toast.success(`Updated role for ${member.email}`);
        await fetchMembers();
      } catch {
        toast.error("Failed to update role");
      }
    });
  }

  function removeMember(member: HubMember) {
    if (!confirm(`Remove ${member.email} from ${hubName}?`)) return;

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/hubs/${hubId}/members/${member.id}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Failed to remove");
        toast.success(`Removed ${member.email}`);
        await fetchMembers();
      } catch {
        toast.error("Failed to remove member");
      }
    });
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? "Loading..." : `${members.length} member${members.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      <InviteForm
        onInvite={invite}
        onBulkInvite={bulkInvite}
        isPending={isPending}
      />

      <div className="mt-6">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="border border-border rounded-lg p-8 text-center">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No members yet. Invite client users above.
            </p>
          </div>
        ) : (
          <MemberList
            members={members}
            onResend={resendInvite}
            onChangeRole={changeRole}
            onRemove={removeMember}
            isPending={isPending}
          />
        )}
      </div>
    </div>
  );
}
