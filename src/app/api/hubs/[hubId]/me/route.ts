import { NextResponse } from "next/server";
import { withHubAuth, type HubAuthError } from "@/lib/hub-auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET: Current user's membership info for a hub
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const { hubId } = await params;

    const auth = await withHubAuth(hubId);
    if ("error" in auth) {
      return NextResponse.json(
        { error: (auth as HubAuthError).error },
        { status: (auth as HubAuthError).status }
      );
    }

    const { user, role } = auth;

    // Get hub name and settings
    const { data: hub } = await supabaseAdmin
      .from("client_hubs")
      .select("name, request_forms_enabled")
      .eq("id", hubId)
      .single();

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role,
      hubId,
      hubName: hub?.name ?? null,
      isViewOnly: role === "view_only",
      requestFormsEnabled: hub?.request_forms_enabled ?? false,
    });
  } catch (error) {
    console.error("GET /api/hubs/[hubId]/me error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
