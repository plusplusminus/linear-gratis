import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { supabaseAdmin, type HubTeamMapping } from "@/lib/supabase";
import { getWorkspaceToken } from "@/lib/workspace";
import {
  fetchAllIssues,
  fetchAllTeams,
  fetchAllProjects,
  fetchAllInitiatives,
  fetchAllCycles,
  fetchCommentsForIssue,
  mapIssueToRow,
  mapTeamToRow,
  mapProjectToRow,
  mapInitiativeToRow,
  mapCycleToRow,
  mapCommentToRow,
  batchUpsert,
} from "@/lib/initial-sync";
import { startSyncRun, completeSyncRun } from "@/lib/sync-logger";

const WORKSPACE_USER_ID = "workspace";

// POST: Manual reconciliation for a specific hub
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { hubId } = await params;

    // Verify hub exists and is active
    const { data: hub } = await supabaseAdmin
      .from("client_hubs")
      .select("id, name, is_active")
      .eq("id", hubId)
      .single();

    if (!hub) {
      return NextResponse.json({ error: "Hub not found" }, { status: 404 });
    }

    if (!hub.is_active) {
      return NextResponse.json({ error: "Hub is not active" }, { status: 400 });
    }

    // Fetch team mappings
    const { data: mappings } = await supabaseAdmin
      .from("hub_team_mappings")
      .select("*")
      .eq("hub_id", hubId)
      .eq("is_active", true);

    if (!mappings || mappings.length === 0) {
      return NextResponse.json(
        { error: "No teams configured for this hub" },
        { status: 400 }
      );
    }

    const apiToken = await getWorkspaceToken();
    const startedAt = Date.now();
    const runId = await startSyncRun({ runType: "reconcile", trigger: "manual", hubId });

    const result = {
      hubId,
      hubName: hub.name,
      teamsUpserted: 0,
      projectsUpserted: 0,
      cyclesUpserted: 0,
      issuesUpserted: 0,
      commentsUpserted: 0,
      initiativesUpserted: 0,
      errors: 0,
    };

    // Org-level: teams
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
      console.error(`Hub ${hubId} reconcile: teams failed:`, error);
      result.errors++;
    }

    // Org-level: initiatives
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
      console.warn(`Hub ${hubId} reconcile: initiatives failed:`, error);
    }

    // Per-team: projects and issues
    for (const mapping of mappings as HubTeamMapping[]) {
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

        const cycles = await fetchAllCycles(apiToken, mapping.linear_team_id);
        if (cycles.length > 0) {
          await batchUpsert(
            "synced_cycles",
            cycles.map((c) => mapCycleToRow(c, WORKSPACE_USER_ID)),
            "user_id,linear_id"
          );
        }
        result.cyclesUpserted += cycles.length;

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
            console.error(`Hub ${hubId} reconcile: comments for issue ${issue.id} failed:`, commentError);
          }
        }
      } catch (error) {
        console.error(
          `Hub ${hubId} reconcile: team ${mapping.linear_team_id} failed:`,
          error
        );
        result.errors++;
      }
    }

    await completeSyncRun({
      runId,
      status: result.errors > 0 ? "failed" : "completed",
      entitiesProcessed: {
        issues: result.issuesUpserted,
        comments: result.commentsUpserted,
        teams: result.teamsUpserted,
        projects: result.projectsUpserted,
        cycles: result.cyclesUpserted,
        initiatives: result.initiativesUpserted,
      },
      errorsCount: result.errors,
      startedAt,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("POST /api/admin/hubs/[hubId]/reconcile error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
