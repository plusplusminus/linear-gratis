import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/admin/settings/admins
 * List all PPM admins with status (active if user_id set, pending if null).
 */
export async function GET() {
  const auth = await withAdminAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await supabaseAdmin
    .from("ppm_admins")
    .select("id, user_id, email, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[GET /api/admin/settings/admins] error:", error);
    return NextResponse.json({ error: "Failed to fetch admins" }, { status: 500 });
  }

  const admins = (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    status: row.user_id ? "active" : "pending",
    created_at: row.created_at,
  }));

  return NextResponse.json(admins);
}

/**
 * POST /api/admin/settings/admins
 * Add a new PPM admin by email. user_id will be filled on first login (lazy claim).
 */
export async function POST(request: Request) {
  const auth = await withAdminAuth();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  // Check for existing admin with this email
  const { data: existing } = await supabaseAdmin
    .from("ppm_admins")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    return NextResponse.json({ error: "This email is already an admin" }, { status: 409 });
  }

  const { data, error } = await supabaseAdmin
    .from("ppm_admins")
    .insert({ email })
    .select("id, email, created_at")
    .single();

  if (error) {
    // Handle race condition: unique constraint violation
    if (error.code === "23505") {
      return NextResponse.json({ error: "This email is already an admin" }, { status: 409 });
    }
    console.error("[POST /api/admin/settings/admins] error:", error);
    return NextResponse.json({ error: "Failed to add admin" }, { status: 500 });
  }

  return NextResponse.json({
    id: data.id,
    email: data.email,
    status: "pending",
    created_at: data.created_at,
  }, { status: 201 });
}
