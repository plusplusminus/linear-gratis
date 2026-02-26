/**
 * Integration smoke test — runs against the REAL Supabase instance.
 *
 * Seeds test rows, calls the actual query functions (fetchSyncedIssues,
 * fetchSyncedComments, fetchSyncedMetadata, fetchSyncedRoadmapIssues,
 * userHasSync), and verifies the returned shapes match what the frontend expects.
 *
 * Cleanup runs in afterAll so even failing tests don't leave garbage.
 *
 * Run with:   npx vitest run integration-smoke
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { supabaseAdmin } from "../supabase";
import {
  fetchSyncedIssues,
  fetchSyncedComments,
  fetchSyncedMetadata,
  fetchSyncedRoadmapIssues,
  userHasSync,
} from "../sync-read";
import {
  mapIssueWebhookToRow,
  mapCommentWebhookToRow,
} from "../webhook-handlers";

// Unique test user ID to isolate this run from real data
const TEST_USER_ID = `__smoke_test_${Date.now()}`;
const TEST_TEAM_ID = "smoke-team-1";
const TEST_PROJECT_ID = "smoke-project-1";

// Track what we insert for cleanup
const insertedIssueIds: string[] = [];
const insertedCommentIds: string[] = [];
let insertedSubscriptionId: string | undefined;

// ── Seed data (matches real Linear webhook shapes) ─────────────────────────

const issuePayloads = [
  {
    id: "smoke-issue-1",
    identifier: "SMOKE-1",
    title: "First smoke test issue",
    description: "Testing the full pipeline end-to-end.",
    state: { id: "state-1", name: "In Progress", color: "#f2c94c", type: "started" },
    priority: 2,
    priorityLabel: "High",
    assignee: { id: "user-1", name: "Alice" },
    labels: [
      { id: "lbl-smoke-1", name: "Bug", color: "#ff0000" },
      { id: "lbl-smoke-2", name: "P1", color: "#ff8800" },
    ],
    dueDate: "2026-06-15",
    url: "https://linear.app/test/issue/SMOKE-1",
    team: { id: TEST_TEAM_ID, name: "Smoke Team", key: "SMOKE" },
    project: { id: TEST_PROJECT_ID, name: "Smoke Project" },
    createdAt: "2026-02-26T10:00:00.000Z",
    updatedAt: "2026-02-26T11:00:00.000Z",
  },
  {
    id: "smoke-issue-2",
    identifier: "SMOKE-2",
    title: "Second smoke test issue",
    state: { id: "state-2", name: "Todo", color: "#e2e2e2", type: "unstarted" },
    priority: 4,
    priorityLabel: "Low",
    assignee: { id: "user-2", name: "Bob" },
    labels: [{ id: "lbl-smoke-3", name: "Feature", color: "#00ff00" }],
    url: "https://linear.app/test/issue/SMOKE-2",
    team: { id: TEST_TEAM_ID, name: "Smoke Team", key: "SMOKE" },
    project: { id: TEST_PROJECT_ID, name: "Smoke Project" },
    createdAt: "2026-02-26T09:00:00.000Z",
    updatedAt: "2026-02-26T09:30:00.000Z",
  },
  {
    id: "smoke-issue-3",
    identifier: "SMOKE-3",
    title: "Minimal issue — no optional fields",
    team: { id: TEST_TEAM_ID, name: "Smoke Team", key: "SMOKE" },
    createdAt: "2026-02-26T08:00:00.000Z",
    updatedAt: "2026-02-26T08:00:00.000Z",
  },
];

const commentPayloads = [
  {
    id: "smoke-comment-1",
    body: "This is a test comment.",
    issue: { id: "smoke-issue-1", title: "First smoke test issue" },
    user: { id: "user-1", name: "Alice" },
    createdAt: "2026-02-26T12:00:00.000Z",
    updatedAt: "2026-02-26T12:00:00.000Z",
  },
  {
    id: "smoke-comment-2",
    body: "Another comment on the same issue.",
    issue: { id: "smoke-issue-1", title: "First smoke test issue" },
    user: { id: "user-2", name: "Bob" },
    createdAt: "2026-02-26T12:05:00.000Z",
    updatedAt: "2026-02-26T12:05:00.000Z",
  },
];

// ── Setup & teardown ───────────────────────────────────────────────────────

beforeAll(async () => {
  // Seed issues via the same mapping pipeline the webhook handler uses
  for (const payload of issuePayloads) {
    const row = mapIssueWebhookToRow(
      "create",
      payload as unknown as Record<string, unknown>,
      TEST_USER_ID
    );
    const { error } = await supabaseAdmin.from("synced_issues").upsert(row, {
      onConflict: "user_id,linear_id",
    });
    if (error) throw new Error(`Failed to seed issue ${payload.id}: ${error.message}`);
    insertedIssueIds.push(payload.id);
  }

  // Seed comments
  for (const payload of commentPayloads) {
    const row = mapCommentWebhookToRow(
      "create",
      payload as unknown as Record<string, unknown>,
      TEST_USER_ID
    );
    const { error } = await supabaseAdmin.from("synced_comments").upsert(row, {
      onConflict: "user_id,linear_id",
    });
    if (error) throw new Error(`Failed to seed comment ${payload.id}: ${error.message}`);
    insertedCommentIds.push(payload.id);
  }

  // Seed a sync subscription so userHasSync returns true
  const { data: sub, error: subErr } = await supabaseAdmin
    .from("sync_subscriptions")
    .insert({
      user_id: TEST_USER_ID,
      linear_team_id: TEST_TEAM_ID,
      is_active: true,
      events: ["Issue", "Comment"],
    })
    .select("id")
    .single();
  if (subErr) throw new Error(`Failed to seed subscription: ${subErr.message}`);
  insertedSubscriptionId = sub.id;
});

afterAll(async () => {
  // Clean up all seeded data
  if (insertedIssueIds.length > 0) {
    await supabaseAdmin
      .from("synced_issues")
      .delete()
      .eq("user_id", TEST_USER_ID);
  }
  if (insertedCommentIds.length > 0) {
    await supabaseAdmin
      .from("synced_comments")
      .delete()
      .eq("user_id", TEST_USER_ID);
  }
  if (insertedSubscriptionId) {
    await supabaseAdmin
      .from("sync_subscriptions")
      .delete()
      .eq("id", insertedSubscriptionId);
  }
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("integration: userHasSync", () => {
  it("returns true for a user with an active subscription", async () => {
    expect(await userHasSync(TEST_USER_ID)).toBe(true);
  });

  it("returns false for a user with no subscription", async () => {
    expect(await userHasSync("nonexistent-user-xyz")).toBe(false);
  });
});

describe("integration: fetchSyncedIssues", () => {
  it("returns all seeded issues for the test user", async () => {
    const issues = await fetchSyncedIssues(TEST_USER_ID, {});
    expect(issues.length).toBe(3);
  });

  it("filters by teamId", async () => {
    const issues = await fetchSyncedIssues(TEST_USER_ID, { teamId: TEST_TEAM_ID });
    expect(issues.length).toBe(3);
  });

  it("filters by projectId", async () => {
    const issues = await fetchSyncedIssues(TEST_USER_ID, { projectId: TEST_PROJECT_ID });
    // Only issues 1 and 2 have project_id set
    expect(issues.length).toBe(2);
  });

  it("filters by statuses", async () => {
    const issues = await fetchSyncedIssues(TEST_USER_ID, { statuses: ["In Progress"] });
    expect(issues.length).toBe(1);
    expect(issues[0].identifier).toBe("SMOKE-1");
  });

  it("returns empty for a non-existent user", async () => {
    const issues = await fetchSyncedIssues("nonexistent-user-xyz", {});
    expect(issues).toEqual([]);
  });

  it("returns issues in the correct LinearIssue shape with full objects", async () => {
    const issues = await fetchSyncedIssues(TEST_USER_ID, {});
    const issue = issues.find((i) => i.identifier === "SMOKE-1")!;

    // Required fields
    expect(issue.id).toBe("smoke-issue-1");
    expect(issue.identifier).toBe("SMOKE-1");
    expect(issue.title).toBe("First smoke test issue");
    expect(issue.description).toBe("Testing the full pipeline end-to-end.");
    expect(issue.url).toBe("https://linear.app/test/issue/SMOKE-1");

    // Priority — uses Linear's own priorityLabel
    expect(issue.priority).toBe(2);
    expect(issue.priorityLabel).toBe("High");

    // State — full object preserved, not just name
    expect(issue.state).toEqual({
      id: "state-1",
      name: "In Progress",
      color: "#f2c94c",
      type: "started",
    });

    // Assignee — full object preserved, not just name
    expect(issue.assignee).toEqual({ id: "user-1", name: "Alice" });

    // Labels preserved as array of objects
    expect(issue.labels).toEqual([
      { id: "lbl-smoke-1", name: "Bug", color: "#ff0000" },
      { id: "lbl-smoke-2", name: "P1", color: "#ff8800" },
    ]);

    // Timestamps are strings
    expect(typeof issue.createdAt).toBe("string");
    expect(typeof issue.updatedAt).toBe("string");
  });

  it("handles the minimal issue (nulls for optional fields)", async () => {
    const issues = await fetchSyncedIssues(TEST_USER_ID, {});
    const minimal = issues.find((i) => i.identifier === "SMOKE-3")!;

    expect(minimal.id).toBe("smoke-issue-3");
    expect(minimal.description).toBeUndefined();
    expect(minimal.priority).toBe(0);
    expect(minimal.priorityLabel).toBe("No priority");
    expect(minimal.state.name).toBe("Unknown");
    expect(minimal.state.id).toBe("");
    expect(minimal.assignee).toBeUndefined();
    expect(minimal.labels).toEqual([]);
    expect(minimal.url).toBe("");
  });

  it("orders issues by updated_at descending", async () => {
    const issues = await fetchSyncedIssues(TEST_USER_ID, {});
    // SMOKE-1 has the latest updated_at, SMOKE-3 the earliest
    expect(issues[0].identifier).toBe("SMOKE-1");
    expect(issues[issues.length - 1].identifier).toBe("SMOKE-3");
  });
});

describe("integration: fetchSyncedComments", () => {
  it("returns comments for the correct issue", async () => {
    const comments = await fetchSyncedComments(TEST_USER_ID, "smoke-issue-1");
    expect(comments.length).toBe(2);
  });

  it("returns empty for an issue with no comments", async () => {
    const comments = await fetchSyncedComments(TEST_USER_ID, "smoke-issue-2");
    expect(comments).toEqual([]);
  });

  it("returns comments with full user objects", async () => {
    const comments = await fetchSyncedComments(TEST_USER_ID, "smoke-issue-1");
    const first = comments[0];

    expect(first.id).toBe("smoke-comment-1");
    expect(first.body).toBe("This is a test comment.");
    expect(first.user).toEqual({ id: "user-1", name: "Alice" });
    expect(typeof first.createdAt).toBe("string");
    expect(typeof first.updatedAt).toBe("string");
  });

  it("orders comments by created_at ascending", async () => {
    const comments = await fetchSyncedComments(TEST_USER_ID, "smoke-issue-1");
    expect(comments[0].id).toBe("smoke-comment-1");
    expect(comments[1].id).toBe("smoke-comment-2");
  });
});

describe("integration: fetchSyncedMetadata", () => {
  it("derives unique states with full objects from data", async () => {
    const meta = await fetchSyncedMetadata(TEST_USER_ID, {});
    expect(meta).not.toBeNull();

    const stateNames = meta!.states.map((s) => s.name).sort();
    expect(stateNames).toContain("In Progress");
    expect(stateNames).toContain("Todo");

    // State objects should have real colors and types now
    const inProgress = meta!.states.find((s) => s.name === "In Progress")!;
    expect(inProgress.color).toBe("#f2c94c");
    expect(inProgress.type).toBe("started");
  });

  it("derives unique labels", async () => {
    const meta = await fetchSyncedMetadata(TEST_USER_ID, {});
    const labelNames = meta!.labels.map((l) => l.name).sort();
    expect(labelNames).toEqual(["Bug", "Feature", "P1"]);
  });

  it("derives unique members with ids", async () => {
    const meta = await fetchSyncedMetadata(TEST_USER_ID, {});
    const members = meta!.members.sort((a, b) => a.name.localeCompare(b.name));
    expect(members).toEqual([
      { id: "user-1", name: "Alice" },
      { id: "user-2", name: "Bob" },
    ]);
  });

  it("filters metadata by projectId", async () => {
    const meta = await fetchSyncedMetadata(TEST_USER_ID, { projectId: TEST_PROJECT_ID });
    // SMOKE-3 has no project, so its null state/assignee shouldn't appear
    const memberNames = meta!.members.map((m) => m.name).sort();
    expect(memberNames).toEqual(["Alice", "Bob"]);
  });
});

describe("integration: fetchSyncedRoadmapIssues", () => {
  it("returns issues for the given project IDs", async () => {
    const issues = await fetchSyncedRoadmapIssues(TEST_USER_ID, [TEST_PROJECT_ID]);
    expect(issues.length).toBe(2); // Only SMOKE-1 and SMOKE-2 have project_id
  });

  it("returns RoadmapIssue shape with dueDate and project", async () => {
    const issues = await fetchSyncedRoadmapIssues(TEST_USER_ID, [TEST_PROJECT_ID]);
    const issue = issues.find((i) => i.identifier === "SMOKE-1")!;

    expect(issue.dueDate).toBe("2026-06-15");
    expect(issue.project).toEqual({
      id: TEST_PROJECT_ID,
      name: "Smoke Project",
      color: undefined,
    });
  });

  it("returns empty for non-existent project", async () => {
    const issues = await fetchSyncedRoadmapIssues(TEST_USER_ID, ["nonexistent"]);
    expect(issues).toEqual([]);
  });
});

describe("integration: webhook → DB → read round-trip", () => {
  it("data written by mapIssueWebhookToRow is read back correctly by fetchSyncedIssues", async () => {
    const issues = await fetchSyncedIssues(TEST_USER_ID, {});
    const issue = issues.find((i) => i.identifier === "SMOKE-1")!;

    // Compare against the original payload
    const original = issuePayloads[0];
    expect(issue.id).toBe(original.id);
    expect(issue.identifier).toBe(original.identifier);
    expect(issue.title).toBe(original.title);
    expect(issue.description).toBe(original.description);
    expect(issue.priority).toBe(original.priority);
    expect(issue.priorityLabel).toBe(original.priorityLabel);
    expect(issue.state).toEqual(original.state);
    expect(issue.assignee).toEqual(original.assignee);
    expect(issue.labels).toEqual(original.labels);
    expect(issue.url).toBe(original.url);
  });

  it("data written by mapCommentWebhookToRow is read back correctly by fetchSyncedComments", async () => {
    const comments = await fetchSyncedComments(TEST_USER_ID, "smoke-issue-1");
    const comment = comments.find((c) => c.id === "smoke-comment-1")!;

    const original = commentPayloads[0];
    expect(comment.id).toBe(original.id);
    expect(comment.body).toBe(original.body);
    expect(comment.user).toEqual(original.user);
  });
});
