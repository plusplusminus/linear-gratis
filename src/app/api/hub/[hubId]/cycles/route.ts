import { NextResponse } from "next/server";
import { withHubAuth, type HubAuthError } from "@/lib/hub-auth";
import { fetchHubCycles, fetchHubCycleStats } from "@/lib/hub-read";

/**
 * GET: List cycles visible to a hub member, enriched with issue stats.
 * Supports optional ?teamId= filter.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const { hubId } = await params;

    const auth = await withHubAuth(hubId);
    if ("error" in auth) {
      return NextResponse.json(
        { error: (auth as HubAuthError).error },
        { status: (auth as HubAuthError).status }
      );
    }

    const url = new URL(request.url);
    const teamId = url.searchParams.get("teamId") ?? undefined;

    const cycles = await fetchHubCycles(hubId, { teamId });
    const cycleIds = cycles.map((c) => c.id);
    const stats = await fetchHubCycleStats(hubId, cycleIds);

    const enriched = cycles.map((cycle) => ({
      ...cycle,
      stats: stats[cycle.id] ?? { total: 0, completed: 0 },
    }));

    return NextResponse.json({ cycles: enriched });
  } catch (error) {
    console.error("GET /api/hub/[hubId]/cycles error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
