import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { getWorkspaceToken } from "@/lib/workspace";

// GET: Fetch labels and workflow states for a team from Linear API
export async function GET(
  request: Request,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await params; // consume params (hubId scoping handled by auth)

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
      return NextResponse.json(
        { error: "teamId query parameter is required" },
        { status: 400 }
      );
    }

    const token = await getWorkspaceToken();

    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({
        query: `
          query TeamOptions($teamId: String!) {
            team(id: $teamId) {
              labels(first: 250) {
                nodes {
                  id
                  name
                  color
                  parent { id name }
                }
              }
              states {
                nodes {
                  id
                  name
                  color
                  type
                  position
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
          labels: {
            nodes: Array<{
              id: string;
              name: string;
              color: string;
              parent?: { id: string; name: string } | null;
            }>;
          };
          states: {
            nodes: Array<{
              id: string;
              name: string;
              color: string;
              type: string;
              position: number;
            }>;
          };
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (result.errors || !result.data?.team) {
      console.error("Linear team options query error:", result.errors);
      return NextResponse.json(
        { error: "Failed to fetch team options from Linear" },
        { status: 502 }
      );
    }

    const states = result.data.team.states.nodes.sort(
      (a, b) => a.position - b.position
    );

    return NextResponse.json({
      labels: result.data.team.labels.nodes,
      states,
    });
  } catch (error) {
    console.error("GET /api/admin/hubs/[hubId]/linear-options error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
