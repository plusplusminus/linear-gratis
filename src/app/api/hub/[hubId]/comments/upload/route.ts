import { NextResponse } from "next/server";
import { withHubAuthWrite, type HubAuthError } from "@/lib/hub-auth";
import { supabaseAdmin } from "@/lib/supabase";

const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // Spreadsheets
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // Archives
  "application/zip",
  // Text
  "text/plain",
]);

const IMAGE_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const OTHER_MAX_SIZE = 25 * 1024 * 1024; // 25MB

function isImageMimeType(contentType: string): boolean {
  return contentType.startsWith("image/");
}

/**
 * POST: Get a signed upload URL for comment file attachments.
 * Allows images, documents, spreadsheets, archives, and plain text.
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

    if (!ALLOWED_MIME_TYPES.has(body.contentType)) {
      return NextResponse.json(
        {
          error: `File type "${body.contentType}" is not allowed. Accepted types: images (PNG, JPEG, GIF, WebP, SVG), documents (PDF, Word, Excel), archives (ZIP), and plain text.`,
        },
        { status: 400 }
      );
    }

    // Sanitize filename and extract extension
    const sanitized = body.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ext = sanitized.split(".").pop() || "bin";
    const storagePath = `${hubId}/comments/${crypto.randomUUID()}.${ext}`;

    const { data: signedData, error } = await supabaseAdmin.storage
      .from("comment-attachments")
      .createSignedUploadUrl(storagePath);

    if (error || !signedData) {
      throw new Error(
        `Failed to create upload URL: ${error?.message ?? "Unknown error"}`
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/comment-attachments/${storagePath}`;
    const maxSize = isImageMimeType(body.contentType)
      ? IMAGE_MAX_SIZE
      : OTHER_MAX_SIZE;

    return NextResponse.json({
      signedUrl: signedData.signedUrl,
      storagePath,
      publicUrl,
      token: signedData.token,
      maxSize,
    });
  } catch (error) {
    console.error(
      "POST /api/hub/[hubId]/comments/upload error:",
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
