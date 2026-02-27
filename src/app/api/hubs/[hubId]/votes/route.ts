import { NextResponse } from "next/server";
import { withHubAuth, type HubAuthError } from "@/lib/hub-auth";
import { supabaseAdmin } from "@/lib/supabase";

type Params = { params: Promise<{ hubId: string }> };

// GET: Fetch vote counts for issue IDs and current user's votes
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
    const issueIds = url.searchParams.get("issueIds")?.split(",").filter(Boolean);
    if (!issueIds || issueIds.length === 0) {
      return NextResponse.json({ counts: {}, userVotes: [] });
    }

    // Fetch all votes for these issues in this hub
    const { data: votes, error } = await supabaseAdmin
      .from("hub_votes")
      .select("issue_linear_id, user_id")
      .eq("hub_id", hubId)
      .in("issue_linear_id", issueIds);

    if (error) {
      console.error("GET /api/hubs/[hubId]/votes error:", error);
      return NextResponse.json({ error: "Failed to fetch votes" }, { status: 500 });
    }

    // Aggregate counts
    const counts: Record<string, number> = {};
    const userVotes: string[] = [];

    for (const vote of votes || []) {
      counts[vote.issue_linear_id] = (counts[vote.issue_linear_id] || 0) + 1;
      if (vote.user_id === auth.user.id) {
        userVotes.push(vote.issue_linear_id);
      }
    }

    return NextResponse.json({ counts, userVotes });
  } catch (error) {
    console.error("GET /api/hubs/[hubId]/votes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Vote on an issue
export async function POST(request: Request, { params }: Params) {
  try {
    const { hubId } = await params;
    const auth = await withHubAuth(hubId);
    if ("error" in auth) {
      return NextResponse.json(
        { error: (auth as HubAuthError).error },
        { status: (auth as HubAuthError).status }
      );
    }

    const body = (await request.json()) as { issueLinearId?: string };
    if (!body.issueLinearId) {
      return NextResponse.json({ error: "issueLinearId is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("hub_votes").insert({
      hub_id: hubId,
      issue_linear_id: body.issueLinearId,
      user_id: auth.user.id,
    });

    if (error) {
      // Unique constraint violation = already voted
      if (error.code === "23505") {
        return NextResponse.json({ error: "Already voted" }, { status: 409 });
      }
      console.error("POST /api/hubs/[hubId]/votes error:", error);
      return NextResponse.json({ error: "Failed to vote" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/hubs/[hubId]/votes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: Remove a vote
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { hubId } = await params;
    const auth = await withHubAuth(hubId);
    if ("error" in auth) {
      return NextResponse.json(
        { error: (auth as HubAuthError).error },
        { status: (auth as HubAuthError).status }
      );
    }

    const body = (await request.json()) as { issueLinearId?: string };
    if (!body.issueLinearId) {
      return NextResponse.json({ error: "issueLinearId is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("hub_votes")
      .delete()
      .eq("hub_id", hubId)
      .eq("issue_linear_id", body.issueLinearId)
      .eq("user_id", auth.user.id);

    if (error) {
      console.error("DELETE /api/hubs/[hubId]/votes error:", error);
      return NextResponse.json({ error: "Failed to remove vote" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/hubs/[hubId]/votes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
