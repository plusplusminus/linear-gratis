import { NextResponse } from "next/server";
import { withHubAuth, type HubAuthError } from "@/lib/hub-auth";
import { fetchHubForms } from "@/lib/form-read";

/**
 * GET: List visible forms for this hub.
 * Returns resolved form list (id, name, type, description) — no field details.
 */
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

    const forms = await fetchHubForms(hubId);

    // Return slim list — no fields, no routing details
    const result = forms.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      description: f.description,
      display_order: f.display_order,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/hub/[hubId]/forms error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
