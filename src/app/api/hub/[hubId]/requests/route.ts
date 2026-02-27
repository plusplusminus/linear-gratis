import { NextResponse } from "next/server";
import { withHubAuthWrite, type HubAuthError } from "@/lib/hub-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getWorkspaceToken } from "@/lib/workspace";

type RequestBody = {
  title: string;
  description: string;
  targetProjectId: string;
  attachmentUrl?: string;
};

/**
 * POST: Submit a customer request (customerNeedCreate) from a hub member.
 * Requires default or admin role (view_only rejected).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const { hubId } = await params;

    const auth = await withHubAuthWrite(hubId);
    if ("error" in auth) {
      return NextResponse.json(
        { error: (auth as HubAuthError).error },
        { status: (auth as HubAuthError).status }
      );
    }

    const { user } = auth;

    // Check request forms are enabled for this hub
    const { data: hub } = await supabaseAdmin
      .from("client_hubs")
      .select("request_forms_enabled")
      .eq("id", hubId)
      .single();

    if (!hub?.request_forms_enabled) {
      return NextResponse.json(
        { error: "Request forms are not enabled for this hub" },
        { status: 403 }
      );
    }

    const body = (await request.json()) as RequestBody;

    if (!body.title?.trim() || !body.targetProjectId) {
      return NextResponse.json(
        { error: "title and targetProjectId are required" },
        { status: 400 }
      );
    }

    // Validate targetProjectId is in hub's visible projects
    const { data: mappings } = await supabaseAdmin
      .from("hub_team_mappings")
      .select("visible_project_ids")
      .eq("hub_id", hubId)
      .eq("is_active", true);

    if (!mappings || mappings.length === 0) {
      return NextResponse.json(
        { error: "Hub has no team mappings" },
        { status: 400 }
      );
    }

    // Collect all visible project IDs (empty array = all visible for that mapping)
    let hasUnscoped = false;
    const allowedIds = new Set<string>();
    for (const m of mappings) {
      const arr = m.visible_project_ids as string[] | null;
      if (!arr || arr.length === 0) {
        hasUnscoped = true;
      } else {
        for (const id of arr) allowedIds.add(id);
      }
    }

    // If no mapping is unscoped, the project must be in the allowed set
    if (!hasUnscoped && !allowedIds.has(body.targetProjectId)) {
      return NextResponse.json(
        { error: "Project is not visible in this hub" },
        { status: 400 }
      );
    }

    // Get workspace token for Linear API
    const apiToken = await getWorkspaceToken();

    const customerName = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ") || user.email;

    const customerNeedInput = {
      customerExternalId: user.email,
      projectId: body.targetProjectId,
      body: `${body.title.trim()}\n\n${body.description?.trim() || ""}`.trim(),
      ...(body.attachmentUrl && { attachmentUrl: body.attachmentUrl }),
    };

    const mutation = `
      mutation CustomerNeedCreate($input: CustomerNeedCreateInput!) {
        customerNeedCreate(input: $input) {
          success
          need {
            id
            body
            customer {
              id
              name
              externalIds
            }
            createdAt
          }
        }
      }
    `;

    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiToken,
      },
      body: JSON.stringify({
        query: mutation,
        variables: { input: customerNeedInput },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Linear API error: ${response.status} ${response.statusText}`
      );
    }

    const result = (await response.json()) as {
      data?: {
        customerNeedCreate: {
          success: boolean;
          need: {
            id: string;
            customer: { id: string; name: string };
            createdAt: string;
          };
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (result.errors) {
      throw new Error(
        `GraphQL errors: ${result.errors.map((e) => e.message).join(", ")}`
      );
    }

    if (!result.data?.customerNeedCreate.success) {
      throw new Error("Failed to create customer request");
    }

    const need = result.data.customerNeedCreate.need;

    return NextResponse.json({
      success: true,
      request: { id: need.id, createdAt: need.createdAt },
    });
  } catch (error) {
    console.error("POST /api/hub/[hubId]/requests error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
