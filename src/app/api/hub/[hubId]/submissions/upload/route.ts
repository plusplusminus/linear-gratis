import { NextResponse } from "next/server";
import { withHubAuthWrite, type HubAuthError } from "@/lib/hub-auth";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * POST: Get a signed upload URL for form attachments.
 * Only allows image/* content types.
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

    const body = (await request.json()) as {
      filename?: string;
      contentType?: string;
    };

    if (!body.filename || !body.contentType) {
      return NextResponse.json(
        { error: "filename and contentType are required" },
        { status: 400 }
      );
    }

    // Only allow images
    if (!body.contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }

    // Sanitize filename
    const sanitized = body.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ext = sanitized.split(".").pop() || "png";
    const storagePath = `${hubId}/${crypto.randomUUID()}.${ext}`;

    const { data: signedData, error } = await supabaseAdmin.storage
      .from("form-attachments")
      .createSignedUploadUrl(storagePath);

    if (error || !signedData) {
      throw new Error(
        `Failed to create upload URL: ${error?.message ?? "Unknown error"}`
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/form-attachments/${storagePath}`;

    return NextResponse.json({
      signedUrl: signedData.signedUrl,
      storagePath,
      publicUrl,
      token: signedData.token,
    });
  } catch (error) {
    console.error(
      "POST /api/hub/[hubId]/submissions/upload error:",
      error
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
