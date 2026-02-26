import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { getWorkspaceToken } from "@/lib/workspace";

// GET: Fetch labels for a specific team from Linear API
// Labels aren't synced to a separate table, so we query Linear directly.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { teamId } = await params;
    const token = await getWorkspaceToken();

    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({
        query: `
          query TeamLabels($teamId: String!) {
            team(id: $teamId) {
              labels(first: 250) {
                nodes {
                  id
                  name
                  color
                  parent { id name }
                }
              }
            }
          }
        `,
        variables: { teamId },
      }),
    });

    const result = (await res.json()) as {
      data?: {
        team?: {
          labels: { nodes: Array<{ id: string; name: string; color: string; parent?: { id: string; name: string } | null }> };
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (result.errors || !result.data?.team) {
      console.error("Linear labels query error:", result.errors);
      return NextResponse.json(
        { error: "Failed to fetch labels from Linear" },
        { status: 502 }
      );
    }

    return NextResponse.json(result.data.team.labels.nodes);
  } catch (error) {
    console.error("GET /api/admin/linear/teams/[teamId]/labels error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
