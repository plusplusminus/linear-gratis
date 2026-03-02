import { NextRequest, NextResponse } from "next/server";
import { processDigests } from "@/lib/notification-digest";

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || cronSecret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const [daily, weekly] = await Promise.all([
      processDigests("daily"),
      processDigests("weekly"),
    ]);

    const durationMs = Date.now() - startTime;

    console.log(
      `send-digests cron completed in ${durationMs}ms — daily: ${daily.sent} sent, ${daily.skipped} skipped, ${daily.errors} errors; weekly: ${weekly.sent} sent, ${weekly.skipped} skipped, ${weekly.errors} errors`
    );

    return NextResponse.json({
      success: true,
      durationMs,
      daily,
      weekly,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.error(`send-digests cron failed after ${durationMs}ms:`, error);
    return NextResponse.json(
      { error: "Internal error", durationMs },
      { status: 500 }
    );
  }
}
