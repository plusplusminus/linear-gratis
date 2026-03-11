import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const shouldThrow = request.nextUrl.searchParams.get("throw") !== "false";
  if (shouldThrow) {
    throw new Error("Sentry server test — API route throw");
  }
  return NextResponse.json({ ok: true });
}
