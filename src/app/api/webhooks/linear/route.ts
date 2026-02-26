import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceSetting } from "@/lib/workspace";
import { isTeamConfigured } from "@/lib/hub-team-lookup";
import {
  verifyWebhookSignature,
  routeWebhookEvent,
} from "@/lib/webhook-handlers";

type WebhookPayload = {
  action: "create" | "update" | "remove";
  type: string;
  data: Record<string, unknown>;
  url?: string;
  createdAt: string;
  webhookId?: string;
  webhookTimestamp?: number;
};

const WORKSPACE_USER_ID = "workspace";

/**
 * Extract team ID from a webhook payload.
 * Returns null for org-level entities (Initiative).
 */
function extractTeamId(payload: WebhookPayload): string | null {
  const { type, data } = payload;

  switch (type) {
    case "Issue": {
      if (typeof data.teamId === "string") return data.teamId;
      const team = data.team as { id?: string } | undefined;
      return team?.id ?? null;
    }
    case "Comment": {
      const issue = data.issue as { team?: { id?: string } } | undefined;
      return issue?.team?.id ?? null;
    }
    case "Project": {
      const teams = (data as { teams?: Array<{ id: string }> }).teams;
      return teams?.[0]?.id ?? null;
    }
    case "Initiative":
      return null;
    default:
      return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("linear-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 }
      );
    }

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody) as WebhookPayload;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    // Verify against workspace webhook secret
    const workspaceSecret = await getWorkspaceSetting("linear_webhook_secret");
    if (!workspaceSecret) {
      return NextResponse.json(
        { error: "No webhook configured" },
        { status: 401 }
      );
    }

    let verified = false;
    try {
      verified = verifyWebhookSignature(rawBody, signature, workspaceSecret);
    } catch {
      // timingSafeEqual throws if lengths differ
    }

    if (!verified) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Discard events from teams not configured in any hub
    const teamId = extractTeamId(payload);
    if (teamId) {
      const configured = await isTeamConfigured(teamId);
      if (!configured) {
        return NextResponse.json({ success: true });
      }
    }
    // teamId === null → org-level entity (Initiative) — always process

    // Route the event
    try {
      await routeWebhookEvent(payload, WORKSPACE_USER_ID);
    } catch (error) {
      console.error("Webhook handler error:", error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook route error:", error);
    return NextResponse.json({ success: true });
  }
}
