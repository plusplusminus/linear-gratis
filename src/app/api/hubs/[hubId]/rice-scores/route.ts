import { NextResponse } from "next/server";
import {
  withHubAuth,
  withHubAuthWrite,
  type HubAuthError,
} from "@/lib/hub-auth";
import {
  fetchUserRiceScores,
  fetchCompositeRiceScores,
  saveRiceScore,
} from "@/lib/hub-rice-scores";

type Params = { params: Promise<{ hubId: string }> };

// GET: Fetch RICE scores (user's own or composite for admin)
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

    const url = new URL(request.url);
    const composite = url.searchParams.get("composite") === "true";

    if (composite) {
      // Admin-only: get all users' scores aggregated
      if (auth.role !== "admin") {
        return NextResponse.json(
          { error: "Admin access required" },
          { status: 403 }
        );
      }
      const scores = await fetchCompositeRiceScores(hubId);
      return NextResponse.json({ scores });
    }

    // Regular user: get own scores
    const scores = await fetchUserRiceScores(hubId, auth.user.id);
    return NextResponse.json({ scores });
  } catch (error) {
    console.error("GET /api/hubs/[hubId]/rice-scores error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT: Save/update RICE score for a single project
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

    let body: {
      projectLinearId?: string;
      reach?: number | null;
      impact?: number | null;
      confidence?: number | null;
      effort?: number | null;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Malformed JSON body" },
        { status: 400 }
      );
    }

    if (!body.projectLinearId) {
      return NextResponse.json(
        { error: "projectLinearId is required" },
        { status: 400 }
      );
    }

    // Validate ranges
    if (body.reach !== undefined && body.reach !== null) {
      if (body.reach < 1 || body.reach > 10) {
        return NextResponse.json(
          { error: "reach must be between 1 and 10" },
          { status: 400 }
        );
      }
    }
    if (body.impact !== undefined && body.impact !== null) {
      const validImpacts = [0.25, 0.5, 1, 2, 3];
      if (!validImpacts.includes(body.impact)) {
        return NextResponse.json(
          { error: "impact must be one of: 0.25, 0.5, 1, 2, 3" },
          { status: 400 }
        );
      }
    }
    if (body.confidence !== undefined && body.confidence !== null) {
      if (body.confidence < 0 || body.confidence > 100) {
        return NextResponse.json(
          { error: "confidence must be between 0 and 100" },
          { status: 400 }
        );
      }
    }
    if (body.effort !== undefined && body.effort !== null) {
      if (body.effort < 0.5) {
        return NextResponse.json(
          { error: "effort must be at least 0.5" },
          { status: 400 }
        );
      }
    }

    await saveRiceScore(hubId, auth.user.id, body.projectLinearId, {
      reach: body.reach,
      impact: body.impact,
      confidence: body.confidence,
      effort: body.effort,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/hubs/[hubId]/rice-scores error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
