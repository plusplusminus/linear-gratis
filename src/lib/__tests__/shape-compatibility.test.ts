import { describe, it, expect } from "vitest";
import { mapRowToLinearIssue, priorityToLabel } from "../sync-read";
import { mapIssueWebhookToRow } from "../webhook-handlers";

/**
 * These tests verify that a full round-trip through the sync pipeline
 * (Linear webhook → Supabase row → LinearIssue shape) produces output
 * that matches the shape the frontend expects from a direct Linear API call.
 *
 * This is the most important test: if this breaks, the frontend silently
 * gets the wrong data shape and things look broken.
 */

// The shape the frontend expects (from fetchLinearIssues in src/lib/linear.ts)
type ExpectedLinearIssue = {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  priority: number;
  priorityLabel: string;
  url: string;
  state: { id: string; name: string; color: string; type: string };
  assignee?: { id: string; name: string };
  labels: Array<{ id: string; name: string; color: string }>;
  createdAt: string;
  updatedAt: string;
};

// Simulate what a Linear webhook sends for an issue create
// (matches real Linear webhook shape from API docs)
const linearWebhookPayload = {
  id: "issue-uuid-abc",
  identifier: "ENG-99",
  title: "Add dark mode support",
  description: "We need dark mode for accessibility.",
  state: { id: "state-1", name: "Todo", color: "#e2e2e2", type: "unstarted" },
  priority: 3,
  priorityLabel: "Medium",
  assignee: { id: "user-1", name: "Charlie" },
  labels: [
    { id: "lbl-a", name: "Feature", color: "#00ff00" },
    { id: "lbl-b", name: "Design", color: "#0000ff" },
  ],
  dueDate: "2026-04-01",
  url: "https://linear.app/team/issue/ENG-99",
  team: { id: "team-abc", name: "Engineering", key: "ENG" },
  project: { id: "project-xyz", name: "Q1" },
  createdAt: "2026-02-26T08:00:00.000Z",
  updatedAt: "2026-02-26T09:00:00.000Z",
};

describe("full round-trip: webhook → row → LinearIssue shape", () => {
  // Step 1: webhook payload → Supabase row
  const row = mapIssueWebhookToRow(
    "create",
    linearWebhookPayload as unknown as Record<string, unknown>,
    "user-123"
  );

  // Step 2: Supabase row → LinearIssue shape
  const result = mapRowToLinearIssue({
    linear_id: row.linear_id as string,
    data: row.data as Record<string, unknown>,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }) as ExpectedLinearIssue;

  it("preserves issue id", () => {
    expect(result.id).toBe("issue-uuid-abc");
  });

  it("preserves identifier", () => {
    expect(result.identifier).toBe("ENG-99");
  });

  it("preserves title", () => {
    expect(result.title).toBe("Add dark mode support");
  });

  it("preserves description", () => {
    expect(result.description).toBe("We need dark mode for accessibility.");
  });

  it("preserves priority as number", () => {
    expect(result.priority).toBe(3);
  });

  it("preserves priorityLabel from Linear", () => {
    expect(result.priorityLabel).toBe("Medium");
  });

  it("preserves url", () => {
    expect(result.url).toBe("https://linear.app/team/issue/ENG-99");
  });

  it("preserves full state object (id, name, color, type)", () => {
    expect(result.state).toEqual({
      id: "state-1",
      name: "Todo",
      color: "#e2e2e2",
      type: "unstarted",
    });
  });

  it("preserves full assignee object (id, name)", () => {
    expect(result.assignee).toBeDefined();
    expect(result.assignee!.id).toBe("user-1");
    expect(result.assignee!.name).toBe("Charlie");
  });

  it("preserves labels array with all fields", () => {
    expect(result.labels).toHaveLength(2);
    expect(result.labels[0]).toEqual({ id: "lbl-a", name: "Feature", color: "#00ff00" });
    expect(result.labels[1]).toEqual({ id: "lbl-b", name: "Design", color: "#0000ff" });
  });

  it("preserves timestamps", () => {
    expect(result.createdAt).toBe("2026-02-26T08:00:00.000Z");
    expect(result.updatedAt).toBe("2026-02-26T09:00:00.000Z");
  });

  it("has all required keys that the frontend expects", () => {
    const requiredKeys: (keyof ExpectedLinearIssue)[] = [
      "id",
      "identifier",
      "title",
      "priority",
      "priorityLabel",
      "url",
      "state",
      "labels",
      "createdAt",
      "updatedAt",
    ];

    for (const key of requiredKeys) {
      expect(result).toHaveProperty(key);
      expect(result[key]).toBeDefined();
    }
  });
});

describe("round-trip with null/missing fields", () => {
  const minimalPayload = {
    id: "issue-minimal",
    identifier: "ENG-1",
    title: "Minimal issue",
  };

  const row = mapIssueWebhookToRow(
    "create",
    minimalPayload as unknown as Record<string, unknown>,
    "user-123"
  );
  const result = mapRowToLinearIssue({
    linear_id: row.linear_id as string,
    data: row.data as Record<string, unknown>,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  });

  it("defaults priority to 0", () => {
    expect(result.priority).toBe(0);
  });

  it("defaults priorityLabel to No priority", () => {
    expect(result.priorityLabel).toBe("No priority");
  });

  it("defaults state to Unknown with empty fields", () => {
    expect(result.state.name).toBe("Unknown");
    expect(result.state.id).toBe("");
    expect(result.state.color).toBe("");
    expect(result.state.type).toBe("");
  });

  it("returns undefined for assignee", () => {
    expect(result.assignee).toBeUndefined();
  });

  it("returns empty labels array", () => {
    expect(result.labels).toEqual([]);
  });

  it("returns empty string for url", () => {
    expect(result.url).toBe("");
  });

  it("returns undefined for description", () => {
    expect(result.description).toBeUndefined();
  });
});
