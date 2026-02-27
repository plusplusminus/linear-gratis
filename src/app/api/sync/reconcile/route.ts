import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getWorkspaceToken } from "@/lib/workspace";
import {
  fetchAllIssues,
  fetchAllTeams,
  fetchAllProjects,
  fetchAllInitiatives,
  fetchCommentsForIssue,
  mapIssueToRow,
  mapTeamToRow,
  mapProjectToRow,
  mapInitiativeToRow,
  mapCommentToRow,
  batchUpsert,
} from "@/lib/initial-sync";

const WORKSPACE_USER_ID = "workspace";

type HubReconcileResult = {
  hubsReconciled: number;
  teamsReconciled: number;
  issuesUpserted: number;
  commentsUpserted: number;
  teamsUpserted: number;
  projectsUpserted: number;
  initiativesUpserted: number;
  errors: number;
};

// POST: Manual reconciliation (triggers full hub reconciliation)
export async function POST() {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;

    const result = await reconcileAllHubs();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("POST /api/sync/reconcile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET: Cron-triggered reconciliation for all active hubs
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: hubs } = await supabaseAdmin
      .from("client_hubs")
      .select("id")
      .eq("is_active", true);

    if (!hubs || hubs.length === 0) {
      return NextResponse.json({ success: true, message: "No active hubs" });
    }

    const result = await reconcileAllHubs();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("GET /api/sync/reconcile error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Reconcile all active hubs. Org-level entities (teams, initiatives) are
 * fetched once. Per-team entities are deduplicated across hubs.
 */
async function reconcileAllHubs(): Promise<HubReconcileResult> {
  const result: HubReconcileResult = {
    hubsReconciled: 0,
    teamsReconciled: 0,
    issuesUpserted: 0,
    commentsUpserted: 0,
    teamsUpserted: 0,
    projectsUpserted: 0,
    initiativesUpserted: 0,
    errors: 0,
  };

  const apiToken = await getWorkspaceToken();

  // 1. Org-level: teams (once)
  try {
    const teams = await fetchAllTeams(apiToken);
    if (teams.length > 0) {
      await batchUpsert(
        "synced_teams",
        teams.map((t) => mapTeamToRow(t, WORKSPACE_USER_ID)),
        "user_id,linear_id"
      );
    }
    result.teamsUpserted = teams.length;
  } catch (error) {
    console.error("Reconcile: teams failed:", error);
    result.errors++;
  }

  // 2. Org-level: initiatives (once)
  try {
    const initiatives = await fetchAllInitiatives(apiToken);
    if (initiatives.length > 0) {
      await batchUpsert(
        "synced_initiatives",
        initiatives.map((i) => mapInitiativeToRow(i, WORKSPACE_USER_ID)),
        "user_id,linear_id"
      );
    }
    result.initiativesUpserted = initiatives.length;
  } catch (error) {
    console.warn("Reconcile: initiatives failed (may lack org scope):", error);
  }

  // 3. Collect all unique team IDs across active hubs
  const { data: mappings } = await supabaseAdmin
    .from("hub_team_mappings")
    .select("hub_id, linear_team_id")
    .eq("is_active", true);

  if (!mappings || mappings.length === 0) {
    console.log("Reconcile: no team mappings found");
    return result;
  }

  // Deduplicate: sync each team only once
  const syncedTeamIds = new Set<string>();
  const hubIds = new Set<string>();

  for (const mapping of mappings) {
    hubIds.add(mapping.hub_id);

    if (syncedTeamIds.has(mapping.linear_team_id)) continue;
    syncedTeamIds.add(mapping.linear_team_id);

    try {
      const projects = await fetchAllProjects(apiToken, mapping.linear_team_id);
      if (projects.length > 0) {
        await batchUpsert(
          "synced_projects",
          projects.map((p) => mapProjectToRow(p, WORKSPACE_USER_ID)),
          "user_id,linear_id"
        );
      }
      result.projectsUpserted += projects.length;

      const issues = await fetchAllIssues(apiToken, mapping.linear_team_id);
      if (issues.length > 0) {
        await batchUpsert(
          "synced_issues",
          issues.map((issue) => mapIssueToRow(issue, WORKSPACE_USER_ID)),
          "user_id,linear_id"
        );
      }
      result.issuesUpserted += issues.length;

      // Comments: fetch per issue and batch upsert
      for (const issue of issues) {
        try {
          const comments = await fetchCommentsForIssue(apiToken, issue.id);
          if (comments.length > 0) {
            await batchUpsert(
              "synced_comments",
              comments.map((c) => mapCommentToRow(c, issue.id, WORKSPACE_USER_ID)),
              "user_id,linear_id"
            );
            result.commentsUpserted += comments.length;
          }
        } catch (commentError) {
          console.error(`Reconcile: comments for issue ${issue.id} failed:`, commentError);
        }
      }

      result.teamsReconciled++;
    } catch (error) {
      console.error(
        `Reconcile: team ${mapping.linear_team_id} failed:`,
        error
      );
      result.errors++;
    }
  }

  result.hubsReconciled = hubIds.size;

  console.log(
    `Reconcile complete: ${result.hubsReconciled} hubs, ${result.teamsReconciled} teams, ` +
      `${result.issuesUpserted} issues, ${result.commentsUpserted} comments, ` +
      `${result.projectsUpserted} projects, ` +
      `${result.initiativesUpserted} initiatives, ${result.errors} errors`
  );

  return result;
}
