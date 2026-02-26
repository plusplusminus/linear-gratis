import { NextResponse } from "next/server";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { supabaseAdmin } from "@/lib/supabase";
import { getWorkspaceSetting } from "@/lib/workspace";

const WORKSPACE_USER_ID = "workspace";

// GET: Fetch workspace sync status
export async function GET() {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webhookId = await getWorkspaceSetting("linear_webhook_id");

    // Count all workspace-level synced entities in parallel
    const [
      { count: issueCount },
      { count: commentCount },
      { count: teamCount },
      { count: projectCount },
      { count: initiativeCount },
    ] = await Promise.all([
      supabaseAdmin.from("synced_issues").select("id", { count: "exact", head: true }).eq("user_id", WORKSPACE_USER_ID),
      supabaseAdmin.from("synced_comments").select("id", { count: "exact", head: true }).eq("user_id", WORKSPACE_USER_ID),
      supabaseAdmin.from("synced_teams").select("id", { count: "exact", head: true }).eq("user_id", WORKSPACE_USER_ID),
      supabaseAdmin.from("synced_projects").select("id", { count: "exact", head: true }).eq("user_id", WORKSPACE_USER_ID),
      supabaseAdmin.from("synced_initiatives").select("id", { count: "exact", head: true }).eq("user_id", WORKSPACE_USER_ID),
    ]);

    // Count hubs
    const { count: hubCount } = await supabaseAdmin
      .from("client_hubs")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    // Last synced time
    const syncedAtResults = await Promise.all(
      ["synced_issues", "synced_comments", "synced_teams", "synced_projects", "synced_initiatives"].map((table) =>
        supabaseAdmin
          .from(table)
          .select("synced_at")
          .eq("user_id", WORKSPACE_USER_ID)
          .order("synced_at", { ascending: false })
          .limit(1)
          .single()
      )
    );

    const lastSyncedAt = syncedAtResults
      .map((r) => r.data?.synced_at as string | undefined)
      .filter(Boolean)
      .sort()
      .pop() ?? null;

    return NextResponse.json({
      connected: !!webhookId,
      webhookId: webhookId || null,
      hubCount: hubCount || 0,
      issueCount: issueCount || 0,
      commentCount: commentCount || 0,
      teamCount: teamCount || 0,
      projectCount: projectCount || 0,
      initiativeCount: initiativeCount || 0,
      lastSyncedAt,
    });
  } catch (error) {
    console.error("GET /api/sync/subscribe error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
