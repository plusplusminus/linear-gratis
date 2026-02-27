import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getWorkspaceToken } from "@/lib/workspace";

// GET: List all initiatives — from synced data, or Linear API if no sync exists
export async function GET() {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data: initiatives, error } = await supabaseAdmin
      .from("synced_initiatives")
      .select("*")
      .eq("user_id", "workspace")
      .order("name", { ascending: true });

    if (error) {
      console.error("GET /api/admin/linear/initiatives error:", error);
      return NextResponse.json(
        { error: "Failed to fetch initiatives" },
        { status: 500 }
      );
    }

    // If we have synced initiatives, return them
    if (initiatives && initiatives.length > 0) {
      return NextResponse.json(initiatives);
    }

    // No synced initiatives — fetch directly from Linear API
    let token: string;
    try {
      token = await getWorkspaceToken();
    } catch {
      return NextResponse.json([]);
    }

    const res = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({
        query: `query { initiatives { nodes { id name color icon status } } }`,
      }),
    });

    const result = (await res.json()) as {
      data?: {
        initiatives: {
          nodes: Array<{
            id: string;
            name: string;
            color?: string;
            icon?: string;
            status?: string;
          }>;
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (result.errors || !result.data) {
      return NextResponse.json([]);
    }

    const liveInitiatives = result.data.initiatives.nodes.map((i) => ({
      linear_id: i.id,
      name: i.name,
      status: i.status ?? null,
      data: { id: i.id, name: i.name, color: i.color, icon: i.icon, status: i.status },
    }));

    return NextResponse.json(liveInitiatives);
  } catch (error) {
    console.error("GET /api/admin/linear/initiatives error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
