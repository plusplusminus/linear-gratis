import { NextRequest, NextResponse } from "next/server";
import { retryFailedEmails } from "@/lib/notification-delivery";
import { captureServerEvent, flushPostHog } from "@/lib/posthog-server";
import { POSTHOG_EVENTS } from "@/lib/posthog-events";

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || cronSecret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await retryFailedEmails(3);

    try {
      captureServerEvent("system", POSTHOG_EVENTS.email_queued, {
        count: result.retried,
      });
      await flushPostHog();
    } catch (err) {
      console.error("PostHog telemetry error:", err);
    }

    return NextResponse.json({
      success: true,
      retried: result.retried,
      succeeded: result.succeeded,
    });
  } catch (error) {
    console.error("process-email-queue cron error:", error);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
