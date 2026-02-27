import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { createHubOrganization } from "@/lib/workos-org";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("client_hubs")
    .select("slug")
    .like("slug", `${baseSlug}%`);

  const existing = new Set((data ?? []).map((r) => r.slug));
  if (!existing.has(baseSlug)) return baseSlug;

  let i = 2;
  while (existing.has(`${baseSlug}-${i}`)) i++;
  return `${baseSlug}-${i}`;
}

// POST: Create a hub
export async function POST(request: Request) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;

    const body = (await request.json()) as { name?: string; slug?: string };

    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const baseSlug = body.slug
      ? generateSlug(body.slug)
      : generateSlug(body.name);

    if (!baseSlug) {
      return NextResponse.json(
        { error: "Could not generate a valid slug from the provided name" },
        { status: 400 }
      );
    }

    const slug = await ensureUniqueSlug(baseSlug);
    const hubName = body.name.trim();

    // Create WorkOS Organization for this hub
    let workosOrgId: string;
    try {
      workosOrgId = await createHubOrganization(hubName);
    } catch (error) {
      console.error("POST /api/admin/hubs WorkOS org creation failed:", error);
      return NextResponse.json(
        { error: "Failed to create authentication organization" },
        { status: 500 }
      );
    }

    const { data: hub, error } = await supabaseAdmin
      .from("client_hubs")
      .insert({
        name: hubName,
        slug,
        created_by: user.id,
        workos_org_id: workosOrgId,
      })
      .select()
      .single();

    if (error) {
      console.error("POST /api/admin/hubs insert error:", error);
      return NextResponse.json(
        { error: "Failed to create hub" },
        { status: 500 }
      );
    }

    return NextResponse.json(hub, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/hubs error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET: List all hubs with team mapping and member counts
export async function GET() {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;

    const { data: hubs, error } = await supabaseAdmin
      .from("client_hubs")
      .select(
        "*, hub_team_mappings(count), hub_members(count)"
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET /api/admin/hubs error:", error);
      return NextResponse.json(
        { error: "Failed to fetch hubs" },
        { status: 500 }
      );
    }

    const result = (hubs ?? []).map((hub) => ({
      ...hub,
      team_count:
        (hub.hub_team_mappings as unknown as { count: number }[])?.[0]?.count ??
        0,
      member_count:
        (hub.hub_members as unknown as { count: number }[])?.[0]?.count ?? 0,
      hub_team_mappings: undefined,
      hub_members: undefined,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/admin/hubs error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
