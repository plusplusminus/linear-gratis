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
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

    const log = await fetchRankingLog(hubId, {
      projectLinearId,
      userId,
      limit: Math.min(limit, 100),
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
