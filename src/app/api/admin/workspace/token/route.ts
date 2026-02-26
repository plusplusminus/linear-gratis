import { NextResponse } from "next/server";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { withAdminAuth } from "@/lib/admin-auth";
import { setWorkspaceToken, getWorkspaceSetting } from "@/lib/workspace";

// POST: Set the workspace Linear API token
export async function POST(request: Request) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;

    const body = (await request.json()) as { token?: string };
    if (!body.token || typeof body.token !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'token' field" },
        { status: 400 }
      );
    }

    const { viewerName, viewerEmail } = await setWorkspaceToken(
      body.token,
      user.id
    );

    return NextResponse.json({
      success: true,
      viewer: { name: viewerName, email: viewerEmail },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    const status = message.startsWith("Invalid Linear API token") ? 400 : 500;
    console.error("POST /api/admin/workspace/token error:", message);
    return NextResponse.json({ error: message }, { status });
  }
}

// GET: Check if a workspace token is configured
export async function GET() {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = await getWorkspaceSetting("linear_api_token");

    return NextResponse.json({
      configured: !!token,
    });
  } catch (error) {
    console.error("GET /api/admin/workspace/token error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
