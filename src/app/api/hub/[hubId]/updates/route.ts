import { NextResponse } from "next/server";
import { withHubAuth, type HubAuthError } from "@/lib/hub-auth";
import { getWorkspaceToken } from "@/lib/workspace";
import { fetchHubProjects } from "@/lib/hub-read";

export async function GET(
  _request: Request,
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

    const projects = await fetchHubProjects(hubId);
    if (projects.length === 0) {
      return NextResponse.json({ updates: [] });
    }

    const token = await getWorkspaceToken();

    // Batch query: fetch updates for all visible projects (up to 10 updates each)
    const projectFragments = projects.map(
      (p, i) =>
        `p${i}: project(id: "${p.id}") { id name color projectUpdates(first: 10) { nodes { id body health createdAt } } }`
    );

    const query = `query HubUpdates { ${projectFragments.join("\n")} }`;

    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token.trim(),
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.error("Linear API error:", await response.text());
      return NextResponse.json(
        { error: "Failed to fetch project updates" },
        { status: 502 }
      );
    }

    const result = (await response.json()) as {
      data?: Record<
        string,
        {
          id: string;
          name: string;
          color: string | null;
          projectUpdates: {
            nodes: Array<{
              id: string;
              body: string;
              health: string;
              createdAt: string;
            }>;
          };
        } | null
      >;
      errors?: Array<{ message: string }>;
    };

    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
    }

    // Flatten all updates across projects
    const updates: Array<{
      id: string;
      body: string;
      health: string;
      createdAt: string;
      projectName: string;
      projectColor: string | null;
    }> = [];

    if (result.data) {
      for (const project of Object.values(result.data)) {
        if (!project?.projectUpdates?.nodes) continue;
        for (const update of project.projectUpdates.nodes) {
          updates.push({
            ...update,
            projectName: project.name,
            projectColor: project.color,
          });
        }
      }
    }

    // Sort newest first
    updates.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ updates });
  } catch (error) {
    console.error("GET /api/hub/[hubId]/updates error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
