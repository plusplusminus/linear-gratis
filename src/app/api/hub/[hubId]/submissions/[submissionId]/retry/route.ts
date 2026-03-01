import { NextResponse } from "next/server";
import { withHubAuthWrite, type HubAuthError } from "@/lib/hub-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { retrySubmission } from "@/lib/form-submit";

/**
 * POST: Retry a failed submission.
 * Verifies the submitter owns the submission.
 */
export async function POST(
  _request: Request,
  {
    params,
  }: { params: Promise<{ hubId: string; submissionId: string }> }
) {
  try {
    const { hubId, submissionId } = await params;

    const auth = await withHubAuthWrite(hubId);
    if ("error" in auth) {
      return NextResponse.json(
        { error: (auth as HubAuthError).error },
        { status: (auth as HubAuthError).status }
      );
    }

    const { user } = auth;

    // Verify submitter owns this submission
    const { data: sub } = await supabaseAdmin
      .from("form_submissions")
      .select("submitter_user_id")
      .eq("id", submissionId)
      .eq("hub_id", hubId)
      .single();

    if (!sub) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    if (sub.submitter_user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only retry your own submissions" },
        { status: 403 }
      );
    }

    const result = await retrySubmission(submissionId);
    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "POST /api/hub/[hubId]/submissions/[submissionId]/retry error:",
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
