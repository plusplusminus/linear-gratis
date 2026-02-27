import { NextResponse } from "next/server";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { getWorkspaceToken, getWorkspaceSetting } from "@/lib/workspace";

/**
 * GET: Return workspace Linear token status and decrypted token
 * for authenticated users. Used by admin pages that need to call
 * Linear API from the client (forms, views, roadmaps).
 */
export async function GET() {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasToken = !!(await getWorkspaceSetting("linear_api_token"));
    if (!hasToken) {
      return NextResponse.json({ configured: false, token: null });
    }

    const token = await getWorkspaceToken();
    return NextResponse.json({ configured: true, token });
  } catch (error) {
    console.error("GET /api/workspace/token error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
