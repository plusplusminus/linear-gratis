import crypto from "crypto";
import { NextResponse } from "next/server";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { withAdminAuth } from "@/lib/admin-auth";
import {
  getWorkspaceToken,
  getWorkspaceSetting,
  setWorkspaceSetting,
} from "@/lib/workspace";

const WEBHOOK_URL =
  (process.env.NEXT_PUBLIC_APP_URL || "https://linear.gratis") +
  "/api/webhooks/linear";

const DEFAULT_RESOURCE_TYPES = ["Issue", "Comment", "Project", "Initiative"];

// POST: Create org-wide webhook (allPublicTeams)
export async function POST() {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;

    // Check if webhook already exists
    const existingId = await getWorkspaceSetting("linear_webhook_id");
    if (existingId) {
      return NextResponse.json(
        { error: "Org-wide webhook already exists" },
        { status: 409 }
      );
    }

    const apiToken = await getWorkspaceToken();
    const webhookSecret = crypto.randomBytes(32).toString("hex");

    const mutation = `
      mutation WebhookCreate($input: WebhookCreateInput!) {
        webhookCreate(input: $input) {
          success
          webhook { id enabled }
        }
      }
    `;

    const res = await fetch("https://api.linear.app/graphql", {
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
            allPublicTeams: true,
          },
        },
      }),
    });

    const result = (await res.json()) as {
      data?: {
        webhookCreate: {
          success: boolean;
          webhook: { id: string; enabled: boolean };
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (result.errors || !result.data?.webhookCreate.success) {
      const msg =
        result.errors?.map((e) => e.message).join(", ") ||
        "Failed to create webhook in Linear";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const webhook = result.data.webhookCreate.webhook;

    // Store webhook credentials in workspace settings
    await setWorkspaceSetting("linear_webhook_id", webhook.id, user.id);
    await setWorkspaceSetting("linear_webhook_secret", webhookSecret, user.id);

    return NextResponse.json({
      success: true,
      webhook: {
        id: webhook.id,
        enabled: webhook.enabled,
        allPublicTeams: true,
        resourceTypes: DEFAULT_RESOURCE_TYPES,
      },
    });
  } catch (error) {
    console.error("POST /api/admin/webhook error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: Remove org-wide webhook
export async function DELETE() {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webhookId = await getWorkspaceSetting("linear_webhook_id");
    if (!webhookId) {
      return NextResponse.json(
        { error: "No webhook configured" },
        { status: 404 }
      );
    }

    // Best-effort: delete from Linear
    try {
      const apiToken = await getWorkspaceToken();
      const mutation = `
        mutation WebhookDelete($id: String!) {
          webhookDelete(id: $id) { success }
        }
      `;
      await fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: apiToken,
        },
        body: JSON.stringify({
          query: mutation,
          variables: { id: webhookId },
        }),
      });
    } catch (error) {
      console.error("Failed to delete webhook from Linear:", error);
    }

    // Remove from workspace settings
    await setWorkspaceSetting("linear_webhook_id", "", user.id);
    await setWorkspaceSetting("linear_webhook_secret", "", user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET: Check webhook status
export async function GET() {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const webhookId = await getWorkspaceSetting("linear_webhook_id");

    return NextResponse.json({
      configured: !!webhookId,
      webhookId: webhookId || null,
    });
  } catch (error) {
    console.error("GET /api/admin/webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
