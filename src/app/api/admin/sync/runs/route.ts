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
      | "running"
      | "completed"
      | "failed"
      | null;
    const run_type = searchParams.get("run_type") as
      | "initial_sync"
      | "reconcile"
      | "hub_sync"
      | null;
    const hub_id = searchParams.get("hub_id");
    const since = searchParams.get("since");

    const offset = (page - 1) * limit;

    // Build data query
    let dataQuery = supabaseAdmin
      .from("sync_runs")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) dataQuery = dataQuery.eq("status", status);
    if (run_type) dataQuery = dataQuery.eq("run_type", run_type);
    if (hub_id) dataQuery = dataQuery.eq("hub_id", hub_id);
    if (since) dataQuery = dataQuery.gte("created_at", since);

    // Build count query with same filters
    let countQuery = supabaseAdmin
      .from("sync_runs")
      .select("id", { count: "exact", head: true });

    if (status) countQuery = countQuery.eq("status", status);
    if (run_type) countQuery = countQuery.eq("run_type", run_type);
    if (hub_id) countQuery = countQuery.eq("hub_id", hub_id);
    if (since) countQuery = countQuery.gte("created_at", since);

    const [{ data: runs, error: dataError }, { count, error: countError }] =
      await Promise.all([dataQuery, countQuery]);

    if (dataError) {
      console.error("GET /api/admin/sync/runs data error:", dataError);
      return NextResponse.json(
        { error: "Failed to fetch sync runs" },
        { status: 500 }
      );
    }

    if (countError) {
      console.error("GET /api/admin/sync/runs count error:", countError);
      return NextResponse.json(
        { error: "Failed to count sync runs" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      runs: runs ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("GET /api/admin/sync/runs error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
