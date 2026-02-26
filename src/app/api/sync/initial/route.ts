import { NextResponse } from "next/server";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptToken } from "@/lib/encryption";
import { runInitialSync } from "@/lib/initial-sync";

export async function POST() {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get active subscription
    const { data: sub } = await supabaseAdmin
      .from("sync_subscriptions")
      .select("linear_team_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!sub) {
      return NextResponse.json(
        { error: "No active sync subscription. Enable sync first." },
        { status: 400 }
      );
    }

    // Get Linear API token
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("linear_api_token")
      .eq("id", user.id)
      .single();

    if (!profile?.linear_api_token) {
      return NextResponse.json(
        { error: "Linear API token not configured." },
        { status: 400 }
      );
    }

    const apiToken = decryptToken(profile.linear_api_token);
    const result = await runInitialSync(apiToken, user.id, sub.linear_team_id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Sync failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      issueCount: result.issueCount,
      commentCount: result.commentCount,
    });
  } catch (error) {
    console.error("POST /api/sync/initial error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
