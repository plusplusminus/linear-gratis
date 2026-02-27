import { NextResponse } from "next/server";
import { withHubAuth, type HubAuthError } from "@/lib/hub-auth";
import { getWorkspaceToken } from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ hubId: string; projectId: string }> }
) {
  try {
    const { hubId, projectId } = await params;

    const auth = await withHubAuth(hubId);
    if ("error" in auth) {
      return NextResponse.json(
        { error: (auth as HubAuthError).error },
        { status: (auth as HubAuthError).status }
      );
    }

    // Verify projectId is visible in this hub's team mappings
    const { data: mappings } = await supabaseAdmin
      .from("hub_team_mappings")
      .select("visible_project_ids")
      .eq("hub_id", hubId)
      .eq("is_active", true);

    if (!mappings || mappings.length === 0) {
      return NextResponse.json(
        { error: "No team mappings found" },
        { status: 404 }
      );
    }

    // Check visibility: if any mapping has empty visible_project_ids, all projects are visible.
    // Otherwise, projectId must be in the union of all visible_project_ids.
    const hasUnscoped = mappings.some(
      (m) => !m.visible_project_ids || m.visible_project_ids.length === 0
    );

    if (!hasUnscoped) {
      const allVisibleIds = new Set(
        mappings.flatMap((m) => m.visible_project_ids ?? [])
      );
      if (!allVisibleIds.has(projectId)) {
        return NextResponse.json(
          { error: "Project not visible in this hub" },
          { status: 403 }
        );
      }
    }

    const token = await getWorkspaceToken();

    const query = `
      query ProjectUpdates($projectId: String!) {
        project(id: $projectId) {
          id
          name
          projectUpdates(first: 50) {
            nodes {
              id
              body
              health
              createdAt
              updatedAt
            }
          }
        }
      }
    `;

    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token.trim(),
      },
      body: JSON.stringify({
        query,
        variables: { projectId },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Linear API error:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch project updates" },
        { status: 502 }
      );
    }

    const result = (await response.json()) as {
      data?: {
        project: {
          id: string;
          name: string;
          projectUpdates: {
            nodes: Array<{
              id: string;
              body: string;
              health: string;
              createdAt: string;
              updatedAt: string;
            }>;
          };
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (result.errors || !result.data?.project) {
      console.error("GraphQL errors:", result.errors);
      return NextResponse.json(
        { error: "Failed to fetch project updates" },
        { status: 502 }
      );
    }

    // Sort by date, newest first
    const updates = result.data.project.projectUpdates.nodes.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      projectName: result.data.project.name,
      updates,
    });
  } catch (error) {
    console.error(
      "GET /api/hub/[hubId]/projects/[projectId]/updates error:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
