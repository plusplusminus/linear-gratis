import { NextResponse } from "next/server";

export async function GET() {
  throw new Error("Sentry server test — API route throw");
  return NextResponse.json({ ok: true });
}
