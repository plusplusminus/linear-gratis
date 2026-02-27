import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { getWorkspaceToken } from "@/lib/workspace";
import {
  fetchAllTeams,
  fetchAllProjects,
  fetchAllInitiatives,
  mapTeamToRow,
  mapProjectToRow,
  mapInitiativeToRow,
  batchUpsert,
} from "@/lib/initial-sync";

const WORKSPACE_USER_ID = "workspace";

/**
 * POST: Lightweight sync for selected teams.
 * Syncs teams, projects, and initiatives so pickers have data.
 * Does NOT sync issues/comments (that's the full hub sync).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { teamIds } = (await request.json()) as { teamIds: string[] };

    if (!teamIds || teamIds.length === 0) {
      return NextResponse.json(
        { error: "No team IDs provided" },
        { status: 400 }
      );
    }

    const apiToken = await getWorkspaceToken();

    // 1. Sync all teams (org-level — quick)
    const teams = await fetchAllTeams(apiToken);
    if (teams.length > 0) {
      await batchUpsert(
        "synced_teams",
        teams.map((t) => mapTeamToRow(t, WORKSPACE_USER_ID)),
        "user_id,linear_id"
      );
    }

    // 2. Sync projects for the selected teams
    let projectCount = 0;
    for (const teamId of teamIds) {
      const projects = await fetchAllProjects(apiToken, teamId);
      if (projects.length > 0) {
        await batchUpsert(
          "synced_projects",
          projects.map((p) => mapProjectToRow(p, WORKSPACE_USER_ID)),
          "user_id,linear_id"
        );
        projectCount += projects.length;
      }
    }

    // 3. Sync initiatives (org-level)
    let initiativeCount = 0;
    try {
      const initiatives = await fetchAllInitiatives(apiToken);
      if (initiatives.length > 0) {
        await batchUpsert(
          "synced_initiatives",
          initiatives.map((i) => mapInitiativeToRow(i, WORKSPACE_USER_ID)),
          "user_id,linear_id"
        );
        initiativeCount = initiatives.length;
      }
    } catch (err) {
      console.warn("Initiative sync failed (may lack org scope):", err);
    }

    return NextResponse.json({
      success: true,
      teamCount: teams.length,
      projectCount,
      initiativeCount,
    });
  } catch (error) {
    console.error("POST /api/admin/sync/teams error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
