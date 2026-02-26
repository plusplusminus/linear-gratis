import { supabaseAdmin } from "@/lib/supabase";
import { encryptToken, decryptToken } from "@/lib/encryption";

/**
 * Read a workspace setting by key.
 */
export async function getWorkspaceSetting(key: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("workspace_settings")
    .select("value")
    .eq("key", key)
    .single();

  return data?.value ?? null;
}

/**
 * Write a workspace setting (upsert).
 */
export async function setWorkspaceSetting(
  key: string,
  value: string,
  updatedBy?: string
): Promise<void> {
  const { error } = await supabaseAdmin.from("workspace_settings").upsert(
    {
      key,
      value,
      updated_by: updatedBy ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    throw new Error(`Failed to set workspace setting '${key}': ${error.message}`);
  }
}

/**
 * Get the workspace-level Linear API token (decrypted).
 */
export async function getWorkspaceToken(): Promise<string> {
  const encrypted = await getWorkspaceSetting("linear_api_token");

  if (!encrypted) {
    throw new Error(
      "No Linear API token configured. Connect your Linear account in workspace settings."
    );
  }

  return decryptToken(encrypted);
}

/**
 * Store the workspace-level Linear API token (validates first).
 */
export async function setWorkspaceToken(
  token: string,
  updatedBy: string
): Promise<{ viewerName: string; viewerEmail: string }> {
  // Validate the token against Linear API
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      query: `query { viewer { id name email } }`,
    }),
  });

  const result = (await res.json()) as {
    data?: { viewer: { id: string; name: string; email: string } };
    errors?: Array<{ message: string }>;
  };

  if (result.errors || !result.data?.viewer) {
    throw new Error(
      "Invalid Linear API token: " +
        (result.errors?.map((e) => e.message).join(", ") || "could not verify")
    );
  }

  const encrypted = encryptToken(token);
  await setWorkspaceSetting("linear_api_token", encrypted, updatedBy);

  return {
    viewerName: result.data.viewer.name,
    viewerEmail: result.data.viewer.email,
  };
}
