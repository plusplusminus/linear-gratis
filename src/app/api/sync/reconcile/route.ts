import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptToken } from "@/lib/encryption";
import {
  fetchAllIssues,
  fetchAllTeams,
  fetchAllProjects,
  fetchAllInitiatives,
  mapIssueToRow,
  mapTeamToRow,
  mapProjectToRow,
  mapInitiativeToRow,
  batchUpsert,
} from "@/lib/initial-sync";

type ReconcileResult = {
  issuesUpserted: number;
  teamsUpserted: number;
  projectsUpserted: number;
  initiativesUpserted: number;
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

    const totals: ReconcileResult = {
      issuesUpserted: 0,
      teamsUpserted: 0,
      projectsUpserted: 0,
      initiativesUpserted: 0,
      errors: 0,
    };

    for (const sub of subs) {
      try {
        const result = await reconcileForUser(sub.user_id);
        totals.issuesUpserted += result.issuesUpserted;
        totals.teamsUpserted += result.teamsUpserted;
        totals.projectsUpserted += result.projectsUpserted;
        totals.initiativesUpserted += result.initiativesUpserted;
        totals.errors += result.errors;
      } catch (error) {
        console.error(`Reconcile failed for user ${sub.user_id}:`, error);
        totals.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      subscriptions: subs.length,
      ...totals,
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
  const result: ReconcileResult = {
    issuesUpserted: 0,
    teamsUpserted: 0,
    projectsUpserted: 0,
    initiativesUpserted: 0,
    errors: 0,
  };

  // Get subscription
  const { data: sub } = await supabaseAdmin
    .from("sync_subscriptions")
    .select("linear_team_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (!sub) return result;

  // Get API token
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("linear_api_token")
    .eq("id", userId)
    .single();

  if (!profile?.linear_api_token) return result;

  const apiToken = decryptToken(profile.linear_api_token);
  const teamId = sub.linear_team_id;

  // 1. Teams — always full-refresh (no webhook events for teams)
  try {
    const teams = await fetchAllTeams(apiToken);
    if (teams.length > 0) {
      await batchUpsert(
        "synced_teams",
        teams.map((t) => mapTeamToRow(t, userId)),
        "user_id,linear_id"
      );
    }
    result.teamsUpserted = teams.length;
  } catch (error) {
    console.error(`Teams reconcile failed for user ${userId}:`, error);
    result.errors++;
  }

  // 2. Projects — full-refresh (team-scoped)
  try {
    const projects = await fetchAllProjects(apiToken, teamId);
    if (projects.length > 0) {
      await batchUpsert(
        "synced_projects",
        projects.map((p) => mapProjectToRow(p, userId)),
        "user_id,linear_id"
      );
    }
    result.projectsUpserted = projects.length;
  } catch (error) {
    console.error(`Projects reconcile failed for user ${userId}:`, error);
    result.errors++;
  }

  // 3. Initiatives — full-refresh (org-level, may lack scope)
  try {
    const initiatives = await fetchAllInitiatives(apiToken);
    if (initiatives.length > 0) {
      await batchUpsert(
        "synced_initiatives",
        initiatives.map((i) => mapInitiativeToRow(i, userId)),
        "user_id,linear_id"
      );
    }
    result.initiativesUpserted = initiatives.length;
  } catch (error) {
    console.warn(`Initiatives reconcile failed for user ${userId} (may lack org scope):`, error);
    // Don't count as error — token may not have org scope
  }

  // 4. Issues — full-refresh using same function as initial sync
  try {
    const issues = await fetchAllIssues(apiToken, teamId);
    if (issues.length > 0) {
      await batchUpsert(
        "synced_issues",
        issues.map((issue) => mapIssueToRow(issue, userId)),
        "user_id,linear_id"
      );
    }
    result.issuesUpserted = issues.length;
  } catch (error) {
    console.error(`Issues reconcile failed for user ${userId}:`, error);
    result.errors++;
  }

  console.log(
    `Reconcile for user ${userId}: ${result.issuesUpserted} issues, ${result.teamsUpserted} teams, ${result.projectsUpserted} projects, ${result.initiativesUpserted} initiatives, ${result.errors} errors`
  );

  return result;
}
