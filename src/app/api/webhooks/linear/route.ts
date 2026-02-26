import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
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

    // Look up all active subscriptions and try to verify against each.
    // Linear includes webhookId in some payloads — use it if available.
    let userId: string | null = null;

    if (payload.webhookId) {
      const { data: sub } = await supabaseAdmin
        .from("sync_subscriptions")
        .select("user_id, webhook_secret")
        .eq("webhook_id", payload.webhookId)
        .eq("is_active", true)
        .single();

      if (sub?.webhook_secret) {
        const valid = verifyWebhookSignature(
          rawBody,
          signature,
          sub.webhook_secret
        );
        if (valid) userId = sub.user_id;
      }
    }

    // Fallback: try all active subscriptions
    if (!userId) {
      const { data: subs } = await supabaseAdmin
        .from("sync_subscriptions")
        .select("user_id, webhook_secret")
        .eq("is_active", true);

      if (subs) {
        for (const sub of subs) {
          if (!sub.webhook_secret) continue;
          try {
            const valid = verifyWebhookSignature(
              rawBody,
              signature,
              sub.webhook_secret
            );
            if (valid) {
              userId = sub.user_id;
              break;
            }
          } catch {
            // timingSafeEqual throws if lengths differ — skip
            continue;
          }
        }
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Route the event — don't let handler errors prevent a 200 response
    try {
      await routeWebhookEvent(payload, userId);
    } catch (error) {
      console.error("Webhook handler error:", error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook route error:", error);
    return NextResponse.json({ success: true });
  }
}
