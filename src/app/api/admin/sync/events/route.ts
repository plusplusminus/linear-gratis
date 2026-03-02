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
    const status = searchParams.get("status") as
      | "success"
      | "error"
      | "skipped"
      | null;
    const event_type = searchParams.get("event_type") as
      | "Issue"
      | "Comment"
      | "Project"
      | "Initiative"
      | null;
    const since = searchParams.get("since");

    const offset = (page - 1) * limit;

    // Build data query
    let dataQuery = supabaseAdmin
      .from("sync_events")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      dataQuery = dataQuery.eq("status", status);
    } else {
      // Hide skipped events by default (unmapped team noise)
      dataQuery = dataQuery.neq("status", "skipped");
    }
    if (event_type) dataQuery = dataQuery.eq("event_type", event_type);
    if (since) dataQuery = dataQuery.gte("created_at", since);

    // Build count query with same filters
    let countQuery = supabaseAdmin
      .from("sync_events")
      .select("id", { count: "exact", head: true });

    if (status) {
      countQuery = countQuery.eq("status", status);
    } else {
      countQuery = countQuery.neq("status", "skipped");
    }
    if (event_type) countQuery = countQuery.eq("event_type", event_type);
    if (since) countQuery = countQuery.gte("created_at", since);

    const [{ data: events, error: dataError }, { count, error: countError }] =
      await Promise.all([dataQuery, countQuery]);

    if (dataError) {
      console.error("GET /api/admin/sync/events data error:", dataError);
      return NextResponse.json(
        { error: "Failed to fetch sync events" },
        { status: 500 }
      );
    }

    if (countError) {
      console.error("GET /api/admin/sync/events count error:", countError);
      return NextResponse.json(
        { error: "Failed to count sync events" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      events: events ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("GET /api/admin/sync/events error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
