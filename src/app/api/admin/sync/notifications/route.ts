import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10))
    );
    const view = searchParams.get("view") ?? "emails"; // "emails" | "events"
    const status = searchParams.get("status"); // pending | sent | failed
    const event_type = searchParams.get("event_type");

    const offset = (page - 1) * limit;

    if (view === "events") {
      // Notification events view
      let dataQuery = supabaseAdmin
        .from("notification_events")
        .select("id, hub_id, team_id, event_type, entity_type, entity_id, actor_name, summary, created_at")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      let countQuery = supabaseAdmin
        .from("notification_events")
        .select("id", { count: "exact", head: true });

      if (event_type) {
        dataQuery = dataQuery.eq("event_type", event_type);
        countQuery = countQuery.eq("event_type", event_type);
      }

      const [{ data, error: dataError }, { count, error: countError }] =
        await Promise.all([dataQuery, countQuery]);

      if (dataError || countError) {
        console.error("GET notifications events error:", dataError ?? countError);
        return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
      }

      return NextResponse.json({
        items: data ?? [],
        total: count ?? 0,
        page,
        limit,
      });
    }

    // Email queue view (default)
    let dataQuery = supabaseAdmin
      .from("notification_email_queue")
      .select("id, notification_event_id, user_id, hub_id, email_address, status, is_digest, resend_message_id, error_message, attempts, created_at, sent_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    let countQuery = supabaseAdmin
      .from("notification_email_queue")
      .select("id", { count: "exact", head: true });

    if (status) {
      dataQuery = dataQuery.eq("status", status);
      countQuery = countQuery.eq("status", status);
    }

    const [{ data, error: dataError }, { count, error: countError }] =
      await Promise.all([dataQuery, countQuery]);

    if (dataError || countError) {
      console.error("GET notifications emails error:", dataError ?? countError);
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }

    // Also fetch summary stats
    const [
      { count: totalSent },
      { count: totalFailed },
      { count: totalPending },
      { count: totalDigests },
    ] = await Promise.all([
      supabaseAdmin.from("notification_email_queue").select("id", { count: "exact", head: true }).eq("status", "sent"),
      supabaseAdmin.from("notification_email_queue").select("id", { count: "exact", head: true }).eq("status", "failed"),
      supabaseAdmin.from("notification_email_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("notification_email_queue").select("id", { count: "exact", head: true }).eq("is_digest", true),
    ]);

    return NextResponse.json({
      items: data ?? [],
      total: count ?? 0,
      page,
      limit,
      stats: {
        sent: totalSent ?? 0,
        failed: totalFailed ?? 0,
        pending: totalPending ?? 0,
        digests: totalDigests ?? 0,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/sync/notifications error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
