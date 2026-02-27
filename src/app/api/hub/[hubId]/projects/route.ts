import { NextResponse } from "next/server";
import { withHubAuth, type HubAuthError } from "@/lib/hub-auth";
import { fetchHubProjects } from "@/lib/hub-read";

/**
 * GET: List projects visible to a hub member.
 * Returns id + name for use in dropdowns.
 */
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

    return NextResponse.json(
      projects.map((p) => ({ id: p.id, name: p.name }))
    );
  } catch (error) {
    console.error("GET /api/hub/[hubId]/projects error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
