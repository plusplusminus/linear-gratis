import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { withAdminAuth } from "@/lib/admin-auth";
import {
  exchangeAuthorizationCode,
  storeOAuthTokens,
  storeOAuthAppInfo,
  getOAuthViewer,
} from "@/lib/linear-oauth";

/**
 * GET: OAuth callback — exchange authorization code for tokens.
 * Linear redirects here after admin approves the OAuth consent screen.
 */
export async function GET(request: Request) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      // Not authenticated — redirect to login
      return NextResponse.redirect(new URL("/", request.url));
    }
    const { user } = auth;

    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // User denied or error from Linear
    if (error) {
      console.error("OAuth callback error from Linear:", error);
      return NextResponse.redirect(
        new URL("/admin/settings/linear?oauth_error=denied", request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/admin/settings/linear?oauth_error=missing_params", request.url)
      );
    }

    // Validate CSRF state
    const cookieStore = await cookies();
    const storedState = cookieStore.get("linear_oauth_state")?.value;
    cookieStore.delete("linear_oauth_state");

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        new URL("/admin/settings/linear?oauth_error=invalid_state", request.url)
      );
    }

    // Exchange code for tokens
    const redirectUri = `${url.origin}/api/admin/workspace/oauth/callback`;
    const { accessToken, refreshToken, expiresIn } = await exchangeAuthorizationCode(
      code,
      redirectUri
    );

    // Store tokens
    await storeOAuthTokens(accessToken, refreshToken, expiresIn, user.id);

    // Get app info and store metadata
    const viewer = await getOAuthViewer(accessToken);
    await storeOAuthAppInfo(viewer.name, user.id);

    return NextResponse.redirect(
      new URL("/admin/settings/linear?oauth_success=true", request.url)
    );
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/admin/settings/linear?oauth_error=exchange_failed", request.url)
    );
  }
}
