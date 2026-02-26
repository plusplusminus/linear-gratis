import crypto from "crypto";
import { NextResponse } from "next/server";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptToken } from "@/lib/encryption";
import { runInitialSync } from "@/lib/initial-sync";

const WEBHOOK_URL =
  (process.env.NEXT_PUBLIC_APP_URL || "https://linear.gratis") +
  "/api/webhooks/linear";

const DEFAULT_RESOURCE_TYPES = ["Issue", "Comment", "Project", "Initiative"];

// -- POST: Create a webhook subscription -------------------------------------

export async function POST() {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user already has an active subscription
    const { data: existing } = await supabaseAdmin
      .from("sync_subscriptions")
      .select("id, webhook_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Sync is already enabled" },
        { status: 409 }
      );
    }

    // Get user's Linear API token
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("linear_api_token")
      .eq("id", user.id)
      .single();

    if (!profile?.linear_api_token) {
      return NextResponse.json(
        { error: "Linear API token not configured. Set it in your profile." },
        { status: 400 }
      );
    }

    const apiToken = decryptToken(profile.linear_api_token);

    // First, fetch user's teams from Linear
    const teamsQuery = `query { teams { nodes { id name } } }`;
    const teamsRes = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiToken,
      },
      body: JSON.stringify({ query: teamsQuery }),
    });

    const teamsResult = (await teamsRes.json()) as {
      data?: { teams: { nodes: Array<{ id: string; name: string }> } };
      errors?: Array<{ message: string }>;
    };

    if (teamsResult.errors || !teamsResult.data?.teams.nodes.length) {
      return NextResponse.json(
        { error: "Could not fetch Linear teams. Check your API token." },
        { status: 400 }
      );
    }

    // Generate a signing secret
    const webhookSecret = crypto.randomBytes(32).toString("hex");

    // Create webhook in Linear
    const mutation = `
      mutation WebhookCreate($input: WebhookCreateInput!) {
        webhookCreate(input: $input) {
          success
          webhook {
            id
            enabled
          }
        }
      }
    `;

    const webhookRes = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiToken,
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: {
            url: WEBHOOK_URL,
            resourceTypes: DEFAULT_RESOURCE_TYPES,
            secret: webhookSecret,
            teamId: teamsResult.data.teams.nodes[0].id,
          },
        },
      }),
    });

    const webhookResult = (await webhookRes.json()) as {
      data?: {
        webhookCreate: {
          success: boolean;
          webhook: { id: string; enabled: boolean };
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (
      webhookResult.errors ||
      !webhookResult.data?.webhookCreate.success
    ) {
      const msg =
        webhookResult.errors?.map((e) => e.message).join(", ") ||
        "Failed to create webhook in Linear";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const webhook = webhookResult.data.webhookCreate.webhook;

    // Store subscription in Supabase
    const { error: insertError } = await supabaseAdmin
      .from("sync_subscriptions")
      .insert({
        user_id: user.id,
        linear_team_id: teamsResult.data.teams.nodes[0].id,
        webhook_id: webhook.id,
        webhook_secret: webhookSecret,
        events: DEFAULT_RESOURCE_TYPES,
        is_active: true,
      });

    if (insertError) {
      console.error("Failed to store subscription:", insertError);
      return NextResponse.json(
        { error: "Webhook created but failed to save subscription" },
        { status: 500 }
      );
    }

    // Trigger initial sync (best-effort — don't block the response on failure)
    const teamId = teamsResult.data.teams.nodes[0].id;
    const syncResult = await runInitialSync(apiToken, user.id, teamId).catch(
      (err) => {
        console.error("Initial sync failed:", err);
        return {
          success: false,
          issueCount: 0,
          commentCount: 0,
          teamCount: 0,
          projectCount: 0,
          initiativeCount: 0,
        };
      }
    );

    return NextResponse.json({
      success: true,
      subscription: {
        webhookId: webhook.id,
        teamId,
        teamName: teamsResult.data.teams.nodes[0].name,
        events: DEFAULT_RESOURCE_TYPES,
      },
      initialSync: {
        success: syncResult.success,
        issueCount: syncResult.issueCount,
        commentCount: syncResult.commentCount,
        teamCount: syncResult.teamCount,
        projectCount: syncResult.projectCount,
        initiativeCount: syncResult.initiativeCount,
      },
    });
  } catch (error) {
    console.error("POST /api/sync/subscribe error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// -- DELETE: Remove webhook and deactivate subscription ----------------------

export async function DELETE() {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: sub } = await supabaseAdmin
      .from("sync_subscriptions")
      .select("id, webhook_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!sub) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    // Get user's Linear API token to delete the webhook
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("linear_api_token")
      .eq("id", user.id)
      .single();

    if (profile?.linear_api_token && sub.webhook_id) {
      const apiToken = decryptToken(profile.linear_api_token);

      const mutation = `
        mutation WebhookDelete($id: String!) {
          webhookDelete(id: $id) {
            success
          }
        }
      `;

      try {
        await fetch("https://api.linear.app/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: apiToken,
          },
          body: JSON.stringify({
            query: mutation,
            variables: { id: sub.webhook_id },
          }),
        });
      } catch (error) {
        // Best-effort deletion from Linear — continue even if it fails
        console.error("Failed to delete webhook from Linear:", error);
      }
    }

    // Deactivate the subscription locally
    const { error } = await supabaseAdmin
      .from("sync_subscriptions")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", sub.id);

    if (error) {
      console.error("Failed to deactivate subscription:", error);
      return NextResponse.json(
        { error: "Failed to deactivate subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/sync/subscribe error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// -- GET: Fetch sync status --------------------------------------------------

export async function GET() {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: sub } = await supabaseAdmin
      .from("sync_subscriptions")
      .select("id, linear_team_id, is_active, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    // Count all entity types in parallel
    const [
      { count: issueCount },
      { count: commentCount },
      { count: teamCount },
      { count: projectCount },
      { count: initiativeCount },
    ] = await Promise.all([
      supabaseAdmin.from("synced_issues").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabaseAdmin.from("synced_comments").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabaseAdmin.from("synced_teams").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabaseAdmin.from("synced_projects").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabaseAdmin.from("synced_initiatives").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);

    // Get last synced time across all entity types
    const syncedAtResults = await Promise.all(
      ["synced_issues", "synced_comments", "synced_teams", "synced_projects", "synced_initiatives"].map((table) =>
        supabaseAdmin
          .from(table)
          .select("synced_at")
          .eq("user_id", user.id)
          .order("synced_at", { ascending: false })
          .limit(1)
          .single()
      )
    );

    const lastSyncedAt = syncedAtResults
      .map((r) => r.data?.synced_at as string | undefined)
      .filter(Boolean)
      .sort()
      .pop() ?? null;

    return NextResponse.json({
      connected: !!sub,
      subscription: sub
        ? {
            id: sub.id,
            teamId: sub.linear_team_id,
            createdAt: sub.created_at,
          }
        : null,
      issueCount: issueCount || 0,
      commentCount: commentCount || 0,
      teamCount: teamCount || 0,
      projectCount: projectCount || 0,
      initiativeCount: initiativeCount || 0,
      lastSyncedAt,
    });
  } catch (error) {
    console.error("GET /api/sync/subscribe error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
