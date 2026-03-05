import { NextResponse } from "next/server";
import { withHubAuth, type HubAuthError } from "@/lib/hub-auth";
import { fetchRankingLog } from "@/lib/hub-rankings";

type Params = { params: Promise<{ hubId: string }> };

// GET: Fetch ranking activity log (admin-only)
export async function GET(request: Request, { params }: Params) {
  try {
    const { hubId } = await params;
    const auth = await withHubAuth(hubId);
    if ("error" in auth) {
      return NextResponse.json(
        { error: (auth as HubAuthError).error },
        { status: (auth as HubAuthError).status }
      );
    }

    // Only admins can view the full log
    if (auth.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const projectLinearId = url.searchParams.get("project") ?? undefined;
    const userId = url.searchParams.get("user") ?? undefined;
    const rawLimit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const rawOffset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
    const offset = Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0);

    const log = await fetchRankingLog(hubId, {
      projectLinearId,
      userId,
      limit,
      offset,
    });

    return NextResponse.json({ log });
  } catch (error) {
    console.error("GET /api/hubs/[hubId]/rankings/log error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
