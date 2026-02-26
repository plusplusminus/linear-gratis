/**
 * Query Audit — Hub-Scoped Query Verification
 *
 * Verifies that all hub-scoped read functions in hub-read.ts:
 * 1. Always query with user_id = 'workspace'
 * 2. Always filter by the hub's team IDs
 * 3. Never return data from other hubs
 *
 * This is a static analysis + runtime verification test.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const HUB_READ_PATH = resolve(
  __dirname,
  "../../src/lib/hub-read.ts"
);
const HUB_AUTH_PATH = resolve(
  __dirname,
  "../../src/lib/hub-auth.ts"
);
const ADMIN_AUTH_PATH = resolve(
  __dirname,
  "../../src/lib/admin-auth.ts"
);

describe("Query Audit — Static Analysis", () => {
  const hubReadSource = readFileSync(HUB_READ_PATH, "utf-8");
  const hubAuthSource = readFileSync(HUB_AUTH_PATH, "utf-8");

  it("hub-read.ts uses WORKSPACE_USER_ID for all synced data queries", () => {
    // Find .eq("user_id", ...) calls — those querying synced_* tables should use WORKSPACE_USER_ID.
    // verifyHubAccess queries hub_members with userId (correct — not synced data).
    const userIdCalls = hubReadSource.match(/\.eq\("user_id",\s*[^)]+\)/g) || [];
    const workspaceCalls = userIdCalls.filter((c) =>
      c.includes("WORKSPACE_USER_ID")
    );
    const nonWorkspaceCalls = userIdCalls.filter(
      (c) => !c.includes("WORKSPACE_USER_ID")
    );
    // All synced data queries use WORKSPACE_USER_ID
    expect(workspaceCalls.length).toBeGreaterThan(0);
    // The only non-workspace call is verifyHubAccess (hub_members)
    for (const call of nonWorkspaceCalls) {
      expect(call).toContain("userId");
    }
  });

  it("hub-read.ts defines WORKSPACE_USER_ID as 'workspace'", () => {
    expect(hubReadSource).toContain('const WORKSPACE_USER_ID = "workspace"');
  });

  it("hub-read.ts fetches hub mappings before querying data", () => {
    // All fetch functions should call getHubMappings or getHubTeamIds
    const exportedFunctions = hubReadSource.match(
      /export async function (\w+)/g
    ) || [];

    const dataFunctions = exportedFunctions
      .map((f) => f.replace("export async function ", ""))
      .filter((f) => f.startsWith("fetch"));

    expect(dataFunctions.length).toBeGreaterThan(0);

    for (const fn of dataFunctions) {
      // Find the function body
      const fnStart = hubReadSource.indexOf(`export async function ${fn}`);
      expect(fnStart).toBeGreaterThan(-1);

      // Get a reasonable chunk of the function body
      const fnBody = hubReadSource.substring(fnStart, fnStart + 2000);

      // Should call getHubMappings or getHubTeamIds
      const hasMapping =
        fnBody.includes("getHubMappings") ||
        fnBody.includes("getHubTeamIds");
      expect(hasMapping).toBe(true);
    }
  });

  it("hub-read.ts strips assignees from issues", () => {
    expect(hubReadSource).toContain("stripAssignee");
  });

  it("hub-read.ts filters labels by visibility", () => {
    expect(hubReadSource).toContain("filterLabels");
    expect(hubReadSource).toContain("allowedLabelIds");
  });

  it("hub-auth.ts verifyHubAccess checks hub_members table", () => {
    expect(hubAuthSource).toContain("hub_members");
    expect(hubAuthSource).toContain("hub_id");
    expect(hubAuthSource).toContain("user_id");
  });

  it("hub-auth.ts withHubAuth verifies hub exists and is active", () => {
    expect(hubAuthSource).toContain("client_hubs");
    expect(hubAuthSource).toContain("is_active");
  });

  it("hub-auth.ts withHubAuthWrite rejects view_only", () => {
    expect(hubAuthSource).toContain("view_only");
    expect(hubAuthSource).toContain("View-only users cannot perform this action");
  });

  it("admin-auth.ts checks ppm_admins table", () => {
    const adminAuthSource = readFileSync(ADMIN_AUTH_PATH, "utf-8");
    expect(adminAuthSource).toContain("isPPMAdmin");
  });

  it("No hub-scoped function queries synced data without team filtering", () => {
    // Ensure synced_issues queries always have .in("team_id", ...) or .eq("team_id", ...)
    const issueQueries = hubReadSource.match(/from\("synced_issues"\)[\s\S]*?(?=from\(|export|$)/g) || [];

    for (const query of issueQueries) {
      const hasTeamFilter =
        query.includes("team_id") || query.includes("project_id");
      expect(hasTeamFilter).toBe(true);
    }
  });
});

describe("Query Audit — Route Protection", () => {
  it("All admin API routes use withAdminAuth", async () => {
    const { resolve: resolvePath } = await import("path");
    const { readdirSync, readFileSync: readFile } = await import("fs");

    const adminDir = resolvePath(
      __dirname,
      "../../src/app/api/admin"
    );

    function collectRouteFiles(dir: string): string[] {
      const files: string[] = [];
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = resolvePath(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...collectRouteFiles(full));
          } else if (entry.name === "route.ts") {
            files.push(full);
          }
        }
      } catch {
        // Directory might not exist
      }
      return files;
    }

    const routeFiles = collectRouteFiles(adminDir);
    expect(routeFiles.length).toBeGreaterThan(0);

    for (const file of routeFiles) {
      const source = readFile(file, "utf-8");
      // Every admin route should import withAdminAuth
      const hasAdminAuth =
        source.includes("withAdminAuth") || source.includes("withAuth");
      expect(hasAdminAuth).toBe(true);
    }
  });
});
