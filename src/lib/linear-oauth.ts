import { supabaseAdmin } from "@/lib/supabase";
import { encryptToken, decryptToken } from "@/lib/encryption";
import { getWorkspaceToken } from "./workspace";
import { getWorkspaceSetting, setWorkspaceSetting } from "./workspace";

const LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token";
const LINEAR_AUTHORIZE_URL = "https://linear.app/oauth/authorize";
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Thrown for OAuth credential validation failures.
 */
export class LinearOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinearOAuthError";
  }
}

type CachedToken = {
  token: string;
  expiresAt: number;
};

// In-memory cache — optimization for hot paths within a single invocation.
// DB-cached tokens are the primary persistent store.
let tokenCache: CachedToken | null = null;

/**
 * Fetch with a timeout to avoid hanging on unresponsive endpoints.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new LinearOAuthError(`Linear API request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// -- Env var credentials ──────────────────────────────────────────────────────

function getClientId(): string | null {
  return process.env.LINEAR_OAUTH_CLIENT_ID ?? null;
}

function getClientSecret(): string | null {
  return process.env.LINEAR_OAUTH_CLIENT_SECRET ?? null;
}

/**
 * Check whether OAuth env vars are configured.
 */
export function isOAuthConfigured(): boolean {
  return !!(getClientId() && getClientSecret());
}

/**
 * Build the Linear OAuth authorization URL for admin consent.
 */
export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const clientId = getClientId();
  if (!clientId) throw new LinearOAuthError("LINEAR_OAUTH_CLIENT_ID is not set");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "read,write",
    actor: "app",
    state,
    prompt: "consent",
  });

  return `${LINEAR_AUTHORIZE_URL}?${params.toString()}`;
}

// -- Token exchange & refresh ─────────────────────────────────────────────────

/**
 * Exchange an authorization code for access + refresh tokens.
 */
export async function exchangeAuthorizationCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new LinearOAuthError("LINEAR_OAUTH_CLIENT_ID or LINEAR_OAUTH_CLIENT_SECRET is not set");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetchWithTimeout(LINEAR_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new LinearOAuthError(`Token exchange failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
    scope: string;
    error?: string;
    error_description?: string;
  };

  if (json.error) {
    throw new LinearOAuthError(`OAuth error: ${json.error_description || json.error}`);
  }

  if (!json.refresh_token) {
    throw new LinearOAuthError("No refresh token returned — ensure refresh tokens are enabled on the OAuth app");
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in,
  };
}

/**
 * Refresh an expired access token using the refresh token.
 */
async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  if (!clientId || !clientSecret) {
    throw new LinearOAuthError("LINEAR_OAUTH_CLIENT_ID or LINEAR_OAUTH_CLIENT_SECRET is not set");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetchWithTimeout(LINEAR_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new LinearOAuthError(`Token refresh failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in: number;
    scope: string;
    error?: string;
    error_description?: string;
  };

  if (json.error) {
    throw new LinearOAuthError(`Refresh error: ${json.error_description || json.error}`);
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresIn: json.expires_in,
  };
}

// -- Token persistence ────────────────────────────────────────────────────────

/**
 * Store OAuth tokens after authorization or refresh.
 */
export async function storeOAuthTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  updatedBy?: string
): Promise<void> {
  const expiresAt = Date.now() + expiresIn * 1000;
  const now = new Date().toISOString();

  const rows = [
    { key: "linear_oauth_token", value: encryptToken(accessToken) },
    { key: "linear_oauth_refresh_token", value: encryptToken(refreshToken) },
    { key: "linear_oauth_token_expires_at", value: String(expiresAt) },
  ];

  for (const row of rows) {
    const { error } = await supabaseAdmin.from("workspace_settings").upsert(
      { ...row, updated_by: updatedBy ?? null, updated_at: now },
      { onConflict: "key" }
    );
    if (error) {
      console.error(`Failed to store '${row.key}':`, error);
    }
  }

  tokenCache = { token: accessToken, expiresAt };
}

/**
 * Store app metadata after successful authorization.
 */
export async function storeOAuthAppInfo(
  appName: string,
  updatedBy: string
): Promise<void> {
  await setWorkspaceSetting("linear_oauth_app_name", appName, updatedBy);
  await setWorkspaceSetting("linear_oauth_connected_at", new Date().toISOString(), updatedBy);
}

/**
 * Check if OAuth has been authorized (tokens exist in DB).
 */
export async function isOAuthAuthorized(): Promise<boolean> {
  const token = await getWorkspaceSetting("linear_oauth_token");
  return !!token;
}

/**
 * Remove all stored OAuth tokens and metadata.
 */
export async function clearOAuthTokens(): Promise<void> {
  const keys = [
    "linear_oauth_token",
    "linear_oauth_refresh_token",
    "linear_oauth_token_expires_at",
    "linear_oauth_app_name",
    "linear_oauth_connected_at",
    // Legacy keys from client_credentials approach
    "linear_oauth_client_id",
    "linear_oauth_client_secret",
  ];

  for (const key of keys) {
    const { error } = await supabaseAdmin
      .from("workspace_settings")
      .delete()
      .eq("key", key);
    if (error) {
      console.error(`Failed to delete '${key}':`, error);
    }
  }

  tokenCache = null;
}

// -- Token retrieval ──────────────────────────────────────────────────────────

/**
 * Get a valid OAuth app token. Refreshes if expired.
 * Returns null if OAuth is not authorized.
 */
export async function getOAuthAppToken(): Promise<string | null> {
  // Check in-memory cache
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  // Check DB
  const [tokenRow, refreshRow, expiresRow] = await Promise.all([
    supabaseAdmin.from("workspace_settings").select("value").eq("key", "linear_oauth_token").single(),
    supabaseAdmin.from("workspace_settings").select("value").eq("key", "linear_oauth_refresh_token").single(),
    supabaseAdmin.from("workspace_settings").select("value").eq("key", "linear_oauth_token_expires_at").single(),
  ]);

  const encryptedToken = tokenRow.data?.value;
  const encryptedRefresh = refreshRow.data?.value;
  const expiresAtStr = expiresRow.data?.value;

  if (!encryptedToken || !encryptedRefresh) return null;

  const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;

  // Token still valid — use it
  if (Date.now() < expiresAt - 60_000) {
    const token = decryptToken(encryptedToken);
    tokenCache = { token, expiresAt };
    return token;
  }

  // Token expired — refresh it
  const currentRefreshToken = decryptToken(encryptedRefresh);
  const { accessToken, refreshToken, expiresIn } = await refreshAccessToken(currentRefreshToken);

  await storeOAuthTokens(accessToken, refreshToken, expiresIn);
  return accessToken;
}

/**
 * Resolve the appropriate token for write operations.
 * Prefers OAuth app token (supports createAsUser). Falls back to personal token.
 */
export async function getWriteToken(): Promise<{
  token: string;
  isOAuthApp: boolean;
}> {
  try {
    const oauthToken = await getOAuthAppToken();
    if (oauthToken) {
      return { token: oauthToken, isOAuthApp: true };
    }
  } catch (err) {
    console.warn("OAuth app token acquisition failed, falling back to personal token:", err);
  }

  const personalToken = await getWorkspaceToken();
  return { token: personalToken, isOAuthApp: false };
}

/**
 * Get the viewer name for an OAuth token (used after authorization).
 */
export async function getOAuthViewer(
  accessToken: string
): Promise<{ name: string }> {
  const res = await fetchWithTimeout("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      query: `query { viewer { id name } }`,
    }),
  });

  const json = (await res.json()) as {
    data?: { viewer: { id: string; name: string } };
    errors?: Array<{ message: string }>;
  };

  if (json.errors || !json.data?.viewer) {
    throw new LinearOAuthError(
      "Viewer query failed: " +
        (json.errors?.map((e) => e.message).join(", ") || "unknown error")
    );
  }

  return { name: json.data.viewer.name };
}
