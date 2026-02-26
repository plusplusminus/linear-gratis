import crypto from "crypto";
import { describe, it, expect } from "vitest";
import {
  verifyWebhookSignature,
  mapIssueWebhookToRow,
  mapCommentWebhookToRow,
  mapProjectWebhookToRow,
  mapInitiativeWebhookToRow,
} from "../webhook-handlers";

// -- Signature verification ---------------------------------------------------

describe("verifyWebhookSignature", () => {
  const secret = "test-webhook-secret-abc123";

  function sign(body: string, key: string): string {
    return crypto.createHmac("sha256", key).update(body).digest("hex");
  }

  it("accepts a valid signature", () => {
    const body = '{"action":"create","type":"Issue"}';
    const sig = sign(body, secret);

    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
  });

  it("rejects a wrong signature", () => {
    const body = '{"action":"create","type":"Issue"}';
    const wrongSig = sign(body, "wrong-secret");

    expect(verifyWebhookSignature(body, wrongSig, secret)).toBe(false);
  });

  it("rejects a tampered body", () => {
    const body = '{"action":"create","type":"Issue"}';
    const sig = sign(body, secret);
    const tampered = '{"action":"remove","type":"Issue"}';

    expect(verifyWebhookSignature(tampered, sig, secret)).toBe(false);
  });

  it("throws on length mismatch (timingSafeEqual)", () => {
    const body = '{"test":true}';
    // A signature that's a completely different length
    expect(() =>
      verifyWebhookSignature(body, "short", secret)
    ).toThrow();
  });

  it("works with empty body", () => {
    const body = "";
    const sig = sign(body, secret);

    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
  });
});

// -- Issue webhook → row mapping ---------------------------------------------

describe("mapIssueWebhookToRow", () => {
  const userId = "user_abc123";

  const fullIssuePayload = {
    id: "linear-issue-id-1",
    identifier: "ENG-42",
    title: "Fix the login bug",
    description: "Users can't log in when...",
    state: { id: "state-1", name: "In Progress", color: "#f2c94c", type: "started" },
    priority: 2,
    priorityLabel: "High",
    assignee: { id: "user-1", name: "Alice" },
    labels: [
      { id: "lbl-1", name: "Bug", color: "#ff0000" },
      { id: "lbl-2", name: "P1", color: "#ff8800" },
    ],
    dueDate: "2026-03-15",
    url: "https://linear.app/team/issue/ENG-42",
    team: { id: "team-1", name: "Engineering", key: "ENG" },
    project: { id: "project-1", name: "Q1 Sprint" },
    createdAt: "2026-02-20T10:00:00.000Z",
    updatedAt: "2026-02-25T14:30:00.000Z",
  };

  it("stores full payload in data field", () => {
    const row = mapIssueWebhookToRow("create", fullIssuePayload as unknown as Record<string, unknown>, userId);

    expect(row.data).toEqual(fullIssuePayload);
  });

  it("extracts indexed columns from a full create payload", () => {
    const row = mapIssueWebhookToRow("create", fullIssuePayload as unknown as Record<string, unknown>, userId);

    expect(row.linear_id).toBe("linear-issue-id-1");
    expect(row.user_id).toBe(userId);
    expect(row.identifier).toBe("ENG-42");
    expect(row.state_name).toBe("In Progress");
    expect(row.priority).toBe(2);
    expect(row.assignee_name).toBe("Alice");
    expect(row.team_id).toBe("team-1");
    expect(row.project_id).toBe("project-1");
    expect(row.created_at).toBe("2026-02-20T10:00:00.000Z");
    expect(row.updated_at).toBe("2026-02-25T14:30:00.000Z");
    expect(row.synced_at).toBeDefined();
  });

  it("sets created_at only on create action", () => {
    const createRow = mapIssueWebhookToRow("create", fullIssuePayload as unknown as Record<string, unknown>, userId);
    const updateRow = mapIssueWebhookToRow("update", fullIssuePayload as unknown as Record<string, unknown>, userId);

    expect(createRow.created_at).toBe("2026-02-20T10:00:00.000Z");
    expect(updateRow.created_at).toBeUndefined();
    expect(updateRow.updated_at).toBe("2026-02-25T14:30:00.000Z");
  });

  it("handles partial update (only title changed)", () => {
    const partial = { id: "linear-issue-id-1", title: "New title" };
    const row = mapIssueWebhookToRow("update", partial as unknown as Record<string, unknown>, userId);

    expect(row.linear_id).toBe("linear-issue-id-1");
    expect(row.data).toEqual(partial); // Full partial payload stored
    // Indexed columns not in payload should be absent
    expect(row.state_name).toBeUndefined();
    expect(row.priority).toBeUndefined();
    expect(row.assignee_name).toBeUndefined();
    expect(row.team_id).toBeUndefined();
    expect(row.project_id).toBeUndefined();
  });

  it("extracts state name for indexed column", () => {
    const data = { id: "x", state: { id: "s1", name: "Done", color: "#0f0", type: "completed" } };
    const row = mapIssueWebhookToRow("update", data as unknown as Record<string, unknown>, userId);

    expect(row.state_name).toBe("Done");
    // Full state object preserved in data
    expect((row.data as Record<string, unknown>).state).toEqual(data.state);
  });

  it("extracts assignee name for indexed column", () => {
    const data = { id: "x", assignee: { id: "a1", name: "Bob" } };
    const row = mapIssueWebhookToRow("update", data as unknown as Record<string, unknown>, userId);

    expect(row.assignee_name).toBe("Bob");
    // Full assignee object preserved in data
    expect((row.data as Record<string, unknown>).assignee).toEqual(data.assignee);
  });

  it("handles priority 0 (no priority) without dropping it", () => {
    const data = { id: "x", priority: 0 };
    const row = mapIssueWebhookToRow("update", data as unknown as Record<string, unknown>, userId);

    expect(row.priority).toBe(0);
  });
});

// -- Comment webhook → row mapping -------------------------------------------

describe("mapCommentWebhookToRow", () => {
  const userId = "user_abc123";

  const fullCommentPayload = {
    id: "linear-comment-id-1",
    body: "This looks good, shipping it.",
    issue: { id: "linear-issue-id-1", title: "Fix login bug" },
    user: { id: "user-1", name: "Alice" },
    createdAt: "2026-02-25T15:00:00.000Z",
    updatedAt: "2026-02-25T15:05:00.000Z",
  };

  it("stores full payload in data field", () => {
    const row = mapCommentWebhookToRow("create", fullCommentPayload as unknown as Record<string, unknown>, userId);

    expect(row.data).toEqual(fullCommentPayload);
  });

  it("extracts indexed columns from a full create payload", () => {
    const row = mapCommentWebhookToRow("create", fullCommentPayload as unknown as Record<string, unknown>, userId);

    expect(row.linear_id).toBe("linear-comment-id-1");
    expect(row.user_id).toBe(userId);
    expect(row.issue_linear_id).toBe("linear-issue-id-1");
    expect(row.created_at).toBe("2026-02-25T15:00:00.000Z");
    expect(row.updated_at).toBe("2026-02-25T15:05:00.000Z");
    expect(row.synced_at).toBeDefined();
  });

  it("handles partial update (only body changed)", () => {
    const partial = { id: "c1", body: "Updated comment text" };
    const row = mapCommentWebhookToRow("update", partial as unknown as Record<string, unknown>, userId);

    expect(row.data).toEqual(partial);
    expect(row.issue_linear_id).toBeUndefined();
  });
});

// -- Project webhook → row mapping -------------------------------------------

describe("mapProjectWebhookToRow", () => {
  const userId = "user_abc123";

  const fullProjectPayload = {
    id: "project-1",
    name: "Q1 Sprint",
    description: "Our Q1 goals",
    status: { id: "status-1", name: "In Progress", color: "#00ff00", type: "started" },
    lead: { id: "user-1", name: "Alice" },
    priority: 2,
    priorityLabel: "High",
    progress: 0.45,
    health: "atRisk",
    startDate: "2026-01-01",
    targetDate: "2026-03-31",
    url: "https://linear.app/team/project/q1-sprint",
    teams: [{ id: "team-1", name: "Engineering", key: "ENG" }],
    initiatives: [{ id: "init-1", name: "Revenue Growth" }],
    milestones: [{ id: "ms-1", name: "MVP", targetDate: "2026-02-15" }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-25T14:30:00.000Z",
  };

  it("stores full payload in data field", () => {
    const row = mapProjectWebhookToRow("create", fullProjectPayload as unknown as Record<string, unknown>, userId);
    expect(row.data).toEqual(fullProjectPayload);
  });

  it("extracts indexed columns from a full create payload", () => {
    const row = mapProjectWebhookToRow("create", fullProjectPayload as unknown as Record<string, unknown>, userId);

    expect(row.linear_id).toBe("project-1");
    expect(row.user_id).toBe(userId);
    expect(row.name).toBe("Q1 Sprint");
    expect(row.status_name).toBe("In Progress");
    expect(row.lead_name).toBe("Alice");
    expect(row.priority).toBe(2);
    expect(row.created_at).toBe("2026-01-01T00:00:00.000Z");
    expect(row.updated_at).toBe("2026-02-25T14:30:00.000Z");
    expect(row.synced_at).toBeDefined();
  });

  it("sets created_at only on create action", () => {
    const createRow = mapProjectWebhookToRow("create", fullProjectPayload as unknown as Record<string, unknown>, userId);
    const updateRow = mapProjectWebhookToRow("update", fullProjectPayload as unknown as Record<string, unknown>, userId);

    expect(createRow.created_at).toBe("2026-01-01T00:00:00.000Z");
    expect(updateRow.created_at).toBeUndefined();
  });

  it("handles partial update (only name changed)", () => {
    const partial = { id: "project-1", name: "Q1 Sprint v2" };
    const row = mapProjectWebhookToRow("update", partial as unknown as Record<string, unknown>, userId);

    expect(row.linear_id).toBe("project-1");
    expect(row.name).toBe("Q1 Sprint v2");
    expect(row.data).toEqual(partial);
    expect(row.status_name).toBeUndefined();
    expect(row.lead_name).toBeUndefined();
    expect(row.priority).toBeUndefined();
  });

  it("extracts status name for indexed column", () => {
    const data = { id: "x", status: { id: "s1", name: "Completed", color: "#0f0", type: "completed" } };
    const row = mapProjectWebhookToRow("update", data as unknown as Record<string, unknown>, userId);

    expect(row.status_name).toBe("Completed");
    expect((row.data as Record<string, unknown>).status).toEqual(data.status);
  });
});

// -- Initiative webhook → row mapping ----------------------------------------

describe("mapInitiativeWebhookToRow", () => {
  const userId = "user_abc123";

  const fullInitiativePayload = {
    id: "init-1",
    name: "Revenue Growth",
    description: "Double ARR by EOY",
    status: "Active",
    health: "onTrack",
    healthUpdatedAt: "2026-02-20T10:00:00.000Z",
    targetDate: "2026-12-31",
    owner: { id: "user-1", name: "Alice" },
    projects: [{ id: "project-1", name: "Q1 Sprint" }],
    subInitiatives: [{ id: "init-2", name: "Enterprise Sales" }],
    parentInitiative: { id: "init-0", name: "Company Goals" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-25T14:30:00.000Z",
  };

  it("stores full payload in data field", () => {
    const row = mapInitiativeWebhookToRow("create", fullInitiativePayload as unknown as Record<string, unknown>, userId);
    expect(row.data).toEqual(fullInitiativePayload);
  });

  it("extracts indexed columns from a full create payload", () => {
    const row = mapInitiativeWebhookToRow("create", fullInitiativePayload as unknown as Record<string, unknown>, userId);

    expect(row.linear_id).toBe("init-1");
    expect(row.user_id).toBe(userId);
    expect(row.name).toBe("Revenue Growth");
    expect(row.status).toBe("Active");
    expect(row.owner_name).toBe("Alice");
    expect(row.created_at).toBe("2026-01-01T00:00:00.000Z");
    expect(row.updated_at).toBe("2026-02-25T14:30:00.000Z");
    expect(row.synced_at).toBeDefined();
  });

  it("sets created_at only on create action", () => {
    const createRow = mapInitiativeWebhookToRow("create", fullInitiativePayload as unknown as Record<string, unknown>, userId);
    const updateRow = mapInitiativeWebhookToRow("update", fullInitiativePayload as unknown as Record<string, unknown>, userId);

    expect(createRow.created_at).toBe("2026-01-01T00:00:00.000Z");
    expect(updateRow.created_at).toBeUndefined();
  });

  it("handles partial update (only status changed)", () => {
    const partial = { id: "init-1", status: "Completed" };
    const row = mapInitiativeWebhookToRow("update", partial as unknown as Record<string, unknown>, userId);

    expect(row.linear_id).toBe("init-1");
    expect(row.status).toBe("Completed");
    expect(row.data).toEqual(partial);
    expect(row.name).toBeUndefined();
    expect(row.owner_name).toBeUndefined();
  });

  it("handles priority 0 equivalent — status as simple string", () => {
    const data = { id: "x", status: "Planned" };
    const row = mapInitiativeWebhookToRow("update", data as unknown as Record<string, unknown>, userId);
    expect(row.status).toBe("Planned");
  });
});
