import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import {
  setWorkspaceToken,
  getWorkspaceSetting,
  setWorkspaceSetting,
} from "@/lib/workspace";
import { supabaseAdmin } from "@/lib/supabase";

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

    // Store viewer info for display without re-querying Linear
    await setWorkspaceSetting("linear_viewer_name", viewerName, user.id);
    await setWorkspaceSetting("linear_viewer_email", viewerEmail, user.id);
    await setWorkspaceSetting(
      "linear_connected_at",
      new Date().toISOString(),
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

// GET: Check token status with viewer info
export async function GET() {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const token = await getWorkspaceSetting("linear_api_token");
    if (!token) {
      return NextResponse.json({ configured: false });
    }

    const viewerName = await getWorkspaceSetting("linear_viewer_name");
    const viewerEmail = await getWorkspaceSetting("linear_viewer_email");
    const connectedAt = await getWorkspaceSetting("linear_connected_at");

    return NextResponse.json({
      configured: true,
      viewer: {
        name: viewerName,
        email: viewerEmail,
      },
      connectedAt,
    });
  } catch (error) {
    console.error("GET /api/admin/workspace/token error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Disconnect (remove token and viewer info)
export async function DELETE() {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const keys = [
      "linear_api_token",
      "linear_viewer_name",
      "linear_viewer_email",
      "linear_connected_at",
    ];

    for (const key of keys) {
      await supabaseAdmin
        .from("workspace_settings")
        .delete()
        .eq("key", key);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/workspace/token error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
