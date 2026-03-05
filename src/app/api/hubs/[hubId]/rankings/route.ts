import { NextResponse } from "next/server";
import { withHubAuth, withHubAuthWrite, type HubAuthError } from "@/lib/hub-auth";
import {
  fetchUserRanking,
  fetchCompositeRanking,
  saveUserRanking,
} from "@/lib/hub-rankings";

type Params = { params: Promise<{ hubId: string }> };

// GET: Fetch current user's ranking and composite ranking
export async function GET(_request: Request, { params }: Params) {
  try {
    const { hubId } = await params;
    const auth = await withHubAuth(hubId);
    if ("error" in auth) {
      return NextResponse.json(
        { error: (auth as HubAuthError).error },
        { status: (auth as HubAuthError).status }
      );
    }

    const [userRanking, composite] = await Promise.all([
      fetchUserRanking(hubId, auth.user.id),
      fetchCompositeRanking(hubId),
    ]);

    return NextResponse.json({
      userRanking: userRanking.map((r) => ({
        projectLinearId: r.project_linear_id,
        rank: r.rank,
      })),
      composite: composite.map((c) => ({
        projectLinearId: c.projectLinearId,
        averageRank: c.averageRank,
        rankerCount: c.rankerCount,
      })),
    });
  } catch (error) {
    console.error("GET /api/hubs/[hubId]/rankings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT: Save user's full ranking
export async function PUT(request: Request, { params }: Params) {
  try {
    const { hubId } = await params;
    const auth = await withHubAuthWrite(hubId);
    if ("error" in auth) {
      return NextResponse.json(
        { error: (auth as HubAuthError).error },
        { status: (auth as HubAuthError).status }
      );
    }

    const body = (await request.json()) as { ranking?: string[] };
    if (!body.ranking || !Array.isArray(body.ranking)) {
      return NextResponse.json(
        { error: "ranking must be an array of project IDs" },
        { status: 400 }
      );
    }

    if (body.ranking.length === 0) {
      return NextResponse.json(
        { error: "ranking cannot be empty" },
        { status: 400 }
      );
    }

    // Check for duplicates
    const uniqueIds = new Set(body.ranking);
    if (uniqueIds.size !== body.ranking.length) {
      return NextResponse.json(
        { error: "ranking contains duplicate project IDs" },
        { status: 400 }
      );
    }

    const changes = await saveUserRanking(hubId, auth.user.id, body.ranking);

    return NextResponse.json({ ok: true, changedCount: changes.length });
  } catch (error) {
    console.error("PUT /api/hubs/[hubId]/rankings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
