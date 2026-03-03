import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * DELETE /api/admin/settings/admins/[adminId]
 * Remove a PPM admin. Prevents self-removal.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ adminId: string }> }
) {
  const auth = await withAdminAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { adminId } = await params;

  // Look up the admin to check identity
  const { data: admin, error: lookupError } = await supabaseAdmin
    .from("ppm_admins")
    .select("id, user_id, email")
    .eq("id", adminId)
    .single();

  if (lookupError || !admin) {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  }

  // Prevent self-removal (check both user_id and email)
  const currentUser = auth.user;
  if (
    (admin.user_id && admin.user_id === currentUser.id) ||
    (admin.email && admin.email === currentUser.email)
  ) {
    return NextResponse.json(
      { error: "You cannot remove yourself as an admin" },
      { status: 403 }
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("ppm_admins")
    .delete()
    .eq("id", adminId);

  if (deleteError) {
    console.error("[DELETE /api/admin/settings/admins] error:", deleteError);
    return NextResponse.json({ error: "Failed to remove admin" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
