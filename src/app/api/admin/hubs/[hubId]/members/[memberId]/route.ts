import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { WorkOS } from "@workos-inc/node";
import { supabaseAdmin, type HubMemberRole } from "@/lib/supabase";

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

// PATCH: Update a member's role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ hubId: string; memberId: string }> }
) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;

    const { hubId, memberId } = await params;

    const body = (await request.json()) as { role?: HubMemberRole };

    if (!body.role || !["default", "view_only"].includes(body.role)) {
      return NextResponse.json(
        { error: "role must be 'default' or 'view_only'" },
        { status: 400 }
      );
    }

    const { data: member, error } = await supabaseAdmin
      .from("hub_members")
      .update({ role: body.role })
      .eq("id", memberId)
      .eq("hub_id", hubId)
      .select()
      .single();

    if (error || !member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error("PATCH /api/admin/hubs/[hubId]/members/[memberId] error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: Remove a member from the hub
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ hubId: string; memberId: string }> }
) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;

    const { hubId, memberId } = await params;

    // Fetch member to get WorkOS info for cleanup
    const { data: member } = await supabaseAdmin
      .from("hub_members")
      .select("user_id, workos_invitation_id, hub_id")
      .eq("id", memberId)
      .eq("hub_id", hubId)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Get hub's WorkOS org to find and clean up the membership
    if (member.user_id) {
      const { data: hub } = await supabaseAdmin
        .from("client_hubs")
        .select("workos_org_id")
        .eq("id", hubId)
        .single();

      if (hub?.workos_org_id) {
        try {
          // Find the WorkOS org membership for this user
          const memberships =
            await workos.userManagement.listOrganizationMemberships({
              userId: member.user_id,
              organizationId: hub.workos_org_id,
            });

          for (const m of memberships.data) {
            await workos.userManagement.deleteOrganizationMembership(m.id);
          }
        } catch (err) {
          console.error("Failed to clean up WorkOS membership:", err);
          // Non-fatal — continue with local deletion
        }
      }
    }

    // Revoke pending invitation if it exists
    if (member.workos_invitation_id) {
      try {
        await workos.userManagement.revokeInvitation(
          member.workos_invitation_id
        );
      } catch (err) {
        console.error("Failed to revoke WorkOS invitation:", err);
        // Non-fatal
      }
    }

    // Delete hub_members row
    const { error } = await supabaseAdmin
      .from("hub_members")
      .delete()
      .eq("id", memberId)
      .eq("hub_id", hubId);

    if (error) {
      console.error("DELETE /api/admin/hubs/[hubId]/members/[memberId] error:", error);
      return NextResponse.json(
        { error: "Failed to remove member" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/hubs/[hubId]/members/[memberId] error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
