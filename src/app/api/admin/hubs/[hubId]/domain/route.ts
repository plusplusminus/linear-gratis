import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET: Fetch the custom domain for a hub (by target_type='hub' + target_slug)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { hubId } = await params;

    // Get the hub slug first
    const { data: hub } = await supabaseAdmin
      .from("client_hubs")
      .select("slug")
      .eq("id", hubId)
      .single();

    if (!hub) {
      return NextResponse.json({ error: "Hub not found" }, { status: 404 });
    }

    const { data: domain } = await supabaseAdmin
      .from("custom_domains")
      .select("*")
      .eq("target_type", "hub")
      .eq("target_slug", hub.slug)
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ domain });
  } catch (error) {
    console.error("GET /api/admin/hubs/[hubId]/domain error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT: Create or update the custom domain for a hub
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;

    const { hubId } = await params;
    const body = (await request.json()) as { domain?: string };

    if (!body.domain || typeof body.domain !== "string") {
      return NextResponse.json(
        { error: "domain is required" },
        { status: 400 }
      );
    }

    const domainName = body.domain.trim().toLowerCase();
    if (!domainName || domainName.includes(" ")) {
      return NextResponse.json(
        { error: "Invalid domain name" },
        { status: 400 }
      );
    }

    // Get the hub slug
    const { data: hub } = await supabaseAdmin
      .from("client_hubs")
      .select("slug, created_by")
      .eq("id", hubId)
      .single();

    if (!hub) {
      return NextResponse.json({ error: "Hub not found" }, { status: 404 });
    }

    // Check if this domain is already taken by another target
    const { data: existing } = await supabaseAdmin
      .from("custom_domains")
      .select("id, target_type, target_slug")
      .eq("domain", domainName)
      .maybeSingle();

    if (
      existing &&
      !(existing.target_type === "hub" && existing.target_slug === hub.slug)
    ) {
      return NextResponse.json(
        { error: "This domain is already in use" },
        { status: 409 }
      );
    }

    // Generate a verification token
    const verificationToken = `linear-verify-${crypto.randomUUID().replace(/-/g, "")}`;

    if (existing) {
      // Update existing record
      const { data: domain, error } = await supabaseAdmin
        .from("custom_domains")
        .update({
          domain: domainName,
          target_type: "hub",
          target_slug: hub.slug,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("Update custom domain error:", error);
        return NextResponse.json(
          { error: "Failed to update domain" },
          { status: 500 }
        );
      }

      return NextResponse.json({ domain });
    } else {
      // Create new record
      const { data: domain, error } = await supabaseAdmin
        .from("custom_domains")
        .insert({
          user_id: hub.created_by,
          domain: domainName,
          verification_token: verificationToken,
          verification_status: "pending",
          ssl_status: "pending",
          is_active: true,
          target_type: "hub",
          target_slug: hub.slug,
        })
        .select()
        .single();

      if (error) {
        console.error("Insert custom domain error:", error);
        return NextResponse.json(
          { error: "Failed to create domain" },
          { status: 500 }
        );
      }

      return NextResponse.json({ domain }, { status: 201 });
    }
  } catch (error) {
    console.error("PUT /api/admin/hubs/[hubId]/domain error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Remove the custom domain for a hub
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { hubId } = await params;

    const { data: hub } = await supabaseAdmin
      .from("client_hubs")
      .select("slug")
      .eq("id", hubId)
      .single();

    if (!hub) {
      return NextResponse.json({ error: "Hub not found" }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from("custom_domains")
      .delete()
      .eq("target_type", "hub")
      .eq("target_slug", hub.slug);

    if (error) {
      console.error("Delete custom domain error:", error);
      return NextResponse.json(
        { error: "Failed to delete domain" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/hubs/[hubId]/domain error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
