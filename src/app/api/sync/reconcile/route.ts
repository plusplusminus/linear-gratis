import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptToken } from "@/lib/encryption";

const LINEAR_API = "https://api.linear.app/graphql";

const RECONCILE_QUERY = `
  query RecentIssues($teamId: String!, $updatedAfter: DateTime!) {
    issues(
      filter: {
        team: { id: { eq: $teamId } }
        updatedAt: { gte: $updatedAfter }
      }
      first: 50
      orderBy: updatedAt
    ) {
      nodes {
        id
        identifier
        title
        description
        priority
        url
        dueDate
        state { name }
        assignee { name }
        labels { nodes { id name color } }
        team { id }
        project { id }
        createdAt
        updatedAt
      }
    }
  }
`;

type ReconcileResult = {
  upserted: number;
  errors: number;
};

// POST: Manual reconciliation (authenticated user)
export async function POST() {
  try {
    const { user } = await withAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await reconcileForUser(user.id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("POST /api/sync/reconcile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET: Cron-triggered reconciliation for all active subscriptions
// Secured by CRON_SECRET header (Vercel cron sends this automatically)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all active subscriptions
    const { data: subs } = await supabaseAdmin
      .from("sync_subscriptions")
      .select("user_id, linear_team_id")
      .eq("is_active", true);

    if (!subs || subs.length === 0) {
      return NextResponse.json({ success: true, message: "No active subscriptions" });
    }

    let totalUpserted = 0;
    let totalErrors = 0;

    for (const sub of subs) {
      try {
        const result = await reconcileForUser(sub.user_id);
        totalUpserted += result.upserted;
        totalErrors += result.errors;
      } catch (error) {
        console.error(`Reconcile failed for user ${sub.user_id}:`, error);
        totalErrors++;
      }
    }

    return NextResponse.json({
      success: true,
      subscriptions: subs.length,
      upserted: totalUpserted,
      errors: totalErrors,
    });
  } catch (error) {
    console.error("GET /api/sync/reconcile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function reconcileForUser(userId: string): Promise<ReconcileResult> {
  // Get subscription
  const { data: sub } = await supabaseAdmin
    .from("sync_subscriptions")
    .select("linear_team_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (!sub) return { upserted: 0, errors: 0 };

  // Get API token
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("linear_api_token")
    .eq("id", userId)
    .single();

  if (!profile?.linear_api_token) return { upserted: 0, errors: 0 };

  const apiToken = decryptToken(profile.linear_api_token);

  // Find the most recent synced_at to limit the query scope
  const { data: lastSync } = await supabaseAdmin
    .from("synced_issues")
    .select("synced_at")
    .eq("user_id", userId)
    .order("synced_at", { ascending: false })
    .limit(1)
    .single();

  // Default to 10 minutes ago if no synced data
  const updatedAfter = lastSync?.synced_at
    ? new Date(new Date(lastSync.synced_at).getTime() - 60_000).toISOString() // 1 min overlap
    : new Date(Date.now() - 10 * 60_000).toISOString();

  // Fetch recently updated issues from Linear
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiToken.trim(),
    },
    body: JSON.stringify({
      query: RECONCILE_QUERY,
      variables: { teamId: sub.linear_team_id, updatedAfter },
    }),
  });

  if (!res.ok) {
    console.error(`Linear API error during reconcile: ${res.status}`);
    return { upserted: 0, errors: 1 };
  }

  const json = (await res.json()) as {
    data?: {
      issues: {
        nodes: Array<{
          id: string;
          identifier: string;
          title: string;
          description?: string;
          priority: number;
          url: string;
          dueDate?: string;
          state?: { name: string };
          assignee?: { name: string };
          labels: { nodes: Array<{ id: string; name: string; color: string }> };
          team?: { id: string };
          project?: { id: string };
          createdAt: string;
          updatedAt: string;
        }>;
      };
    };
    errors?: Array<{ message: string }>;
  };

  if (json.errors || !json.data) {
    console.error("Reconcile GraphQL error:", json.errors);
    return { upserted: 0, errors: 1 };
  }

  const issues = json.data.issues.nodes;
  let upserted = 0;
  let errors = 0;

  for (const issue of issues) {
    const row = {
      linear_id: issue.id,
      user_id: userId,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description ?? null,
      state: issue.state?.name ?? null,
      priority: issue.priority,
      assignee: issue.assignee?.name ?? null,
      labels: issue.labels.nodes,
      due_date: issue.dueDate ?? null,
      url: issue.url,
      team_id: issue.team?.id ?? null,
      project_id: issue.project?.id ?? null,
      created_at: issue.createdAt,
      updated_at: issue.updatedAt,
      synced_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("synced_issues")
      .upsert(row, { onConflict: "user_id,linear_id" });

    if (error) {
      console.error("Reconcile upsert error:", error);
      errors++;
    } else {
      upserted++;
    }
  }

  console.log(
    `Reconcile for user ${userId}: ${upserted} upserted, ${errors} errors`
  );

  return { upserted, errors };
}
