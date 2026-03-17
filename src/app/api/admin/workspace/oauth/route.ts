import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { withAdminAuth } from "@/lib/admin-auth";
import {
  buildAuthorizeUrl,
  isOAuthConfigured,
  isOAuthAuthorized,
  clearOAuthTokens,
} from "@/lib/linear-oauth";
import { getWorkspaceSetting } from "@/lib/workspace";

/**
 * GET: Check OAuth status or initiate OAuth redirect.
 * ?action=connect → redirect to Linear OAuth consent screen
 * No action → return current status
 */
export async function GET(request: Request) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    // Initiate OAuth redirect
    if (action === "connect") {
      if (!isOAuthConfigured()) {
        return NextResponse.json(
          { error: "LINEAR_OAUTH_CLIENT_ID and LINEAR_OAUTH_CLIENT_SECRET environment variables are not set" },
          { status: 500 }
        );
      }

      // Generate CSRF state token
      const state = crypto.randomUUID();
      const cookieStore = await cookies();
      cookieStore.set("linear_oauth_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600, // 10 minutes
        path: "/",
      });

      const redirectUri = `${url.origin}/api/admin/workspace/oauth/callback`;
      const authorizeUrl = buildAuthorizeUrl(redirectUri, state);

      return NextResponse.redirect(authorizeUrl);
    }

    // Return status
    const envConfigured = isOAuthConfigured();
    const authorized = await isOAuthAuthorized();
    const appName = await getWorkspaceSetting("linear_oauth_app_name");
    const connectedAt = await getWorkspaceSetting("linear_oauth_connected_at");

    return NextResponse.json({
      envConfigured,
      authorized,
      app: authorized ? { name: appName } : null,
      connectedAt: authorized ? connectedAt : null,
    });
  } catch (error) {
    console.error("GET /api/admin/workspace/oauth error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Disconnect OAuth (remove stored tokens)
export async function DELETE() {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    await clearOAuthTokens();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/workspace/oauth error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
