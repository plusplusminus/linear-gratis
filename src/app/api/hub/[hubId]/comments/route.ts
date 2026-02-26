import { NextResponse } from "next/server";
import { withHubAuthWrite, type HubAuthError } from "@/lib/hub-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { pushCommentToLinear } from "@/lib/linear-push";

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
    const { issueLinearId, body } = (await request.json()) as {
      issueLinearId?: string;
      body?: string;
    };

    if (!issueLinearId || !body?.trim()) {
      return NextResponse.json(
        { error: "issueLinearId and body are required" },
        { status: 400 }
      );
    }

    const authorName = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ") || user.email;

    // Insert comment locally
    const { data: comment, error: insertError } = await supabaseAdmin
      .from("hub_comments")
      .insert({
        hub_id: hubId,
        issue_linear_id: issueLinearId,
        user_id: user.id,
        author_name: authorName,
        author_email: user.email,
        body: body.trim(),
        push_status: "pending",
      })
      .select("id, author_name, author_email, body, push_status, created_at, updated_at")
      .single();

    if (insertError || !comment) {
      console.error("Insert hub_comment error:", insertError);
      return NextResponse.json(
        { error: "Failed to save comment" },
        { status: 500 }
      );
    }

    // Push to Linear (non-blocking for the response — we update status after)
    const linearBody = `**${authorName}:** ${body.trim()}`;

    try {
      const linearCommentId = await pushCommentToLinear(
        issueLinearId,
        linearBody
      );

      await supabaseAdmin
        .from("hub_comments")
        .update({
          linear_comment_id: linearCommentId,
          push_status: "pushed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", comment.id);

      return NextResponse.json({
        ...comment,
        linear_comment_id: linearCommentId,
        push_status: "pushed",
        isHubComment: true,
        user: { id: user.id, name: authorName },
      });
    } catch (pushError) {
      const errorMsg =
        pushError instanceof Error ? pushError.message : "Unknown push error";
      console.error("Push to Linear failed:", errorMsg);

      await supabaseAdmin
        .from("hub_comments")
        .update({
          push_status: "failed",
          push_error: errorMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", comment.id);

      // Still return the comment — it's saved locally, just not pushed
      return NextResponse.json({
        ...comment,
        push_status: "failed",
        push_error: errorMsg,
        isHubComment: true,
        user: { id: user.id, name: authorName },
      });
    }
  } catch (error) {
    console.error("POST /api/hub/[hubId]/comments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
