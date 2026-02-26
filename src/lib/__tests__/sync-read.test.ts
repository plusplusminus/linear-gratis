import { describe, it, expect } from "vitest";
import { priorityToLabel, mapRowToLinearIssue, mapRowToComment } from "../sync-read";

// -- priorityToLabel ----------------------------------------------------------

describe("priorityToLabel", () => {
  it("maps 0 to No priority", () => {
    expect(priorityToLabel(0)).toBe("No priority");
  });

  it("maps 1 to Urgent", () => {
    expect(priorityToLabel(1)).toBe("Urgent");
  });

  it("maps 2 to High", () => {
    expect(priorityToLabel(2)).toBe("High");
  });

  it("maps 3 to Medium", () => {
    expect(priorityToLabel(3)).toBe("Medium");
  });

  it("maps 4 to Low", () => {
    expect(priorityToLabel(4)).toBe("Low");
  });

  it("maps unknown values to No priority", () => {
    expect(priorityToLabel(5)).toBe("No priority");
    expect(priorityToLabel(-1)).toBe("No priority");
    expect(priorityToLabel(99)).toBe("No priority");
  });
});

// -- mapRowToLinearIssue (JSONB data → LinearIssue shape) --------------------

describe("mapRowToLinearIssue", () => {
  const fullRow = {
    linear_id: "issue-uuid-1",
    created_at: "2026-02-20T10:00:00.000Z",
    updated_at: "2026-02-25T14:30:00.000Z",
    data: {
      id: "issue-uuid-1",
      identifier: "ENG-42",
      title: "Fix login bug",
      description: "Users can't log in",
      priority: 2,
      priorityLabel: "High",
      url: "https://linear.app/issue/ENG-42",
      state: { id: "state-1", name: "In Progress", color: "#f2c94c", type: "started" },
      assignee: { id: "user-1", name: "Alice" },
      labels: [{ id: "lbl-1", name: "Bug", color: "#ff0000" }],
      createdAt: "2026-02-20T10:00:00.000Z",
      updatedAt: "2026-02-25T14:30:00.000Z",
    },
  };

  it("maps id from data", () => {
    const result = mapRowToLinearIssue(fullRow);
    expect(result.id).toBe("issue-uuid-1");
  });

  it("preserves identifier", () => {
    const result = mapRowToLinearIssue(fullRow);
    expect(result.identifier).toBe("ENG-42");
  });

  it("preserves full state object with id, name, color, type", () => {
    const result = mapRowToLinearIssue(fullRow);
    expect(result.state).toEqual({
      id: "state-1",
      name: "In Progress",
      color: "#f2c94c",
      type: "started",
    });
  });

  it("preserves full assignee object with id and name", () => {
    const result = mapRowToLinearIssue(fullRow);
    expect(result.assignee).toEqual({ id: "user-1", name: "Alice" });
  });

  it("uses priorityLabel from data when available", () => {
    const result = mapRowToLinearIssue(fullRow);
    expect(result.priorityLabel).toBe("High");
  });

  it("falls back to computed priorityLabel when not in data", () => {
    const row = {
      ...fullRow,
      data: { ...fullRow.data, priorityLabel: undefined, priority: 3 },
    };
    const result = mapRowToLinearIssue(row);
    expect(result.priorityLabel).toBe("Medium");
  });

  it("returns undefined assignee when not in data", () => {
    const row = { ...fullRow, data: { ...fullRow.data, assignee: undefined } };
    const result = mapRowToLinearIssue(row);
    expect(result.assignee).toBeUndefined();
  });

  it("defaults state to Unknown when not in data", () => {
    const row = { ...fullRow, data: { ...fullRow.data, state: undefined } };
    const result = mapRowToLinearIssue(row);
    expect(result.state.name).toBe("Unknown");
    expect(result.state.id).toBe("");
  });

  it("defaults priority to 0 when not in data", () => {
    const row = { ...fullRow, data: { ...fullRow.data, priority: undefined, priorityLabel: undefined } };
    const result = mapRowToLinearIssue(row);
    expect(result.priority).toBe(0);
    expect(result.priorityLabel).toBe("No priority");
  });

  it("preserves labels array as-is", () => {
    const result = mapRowToLinearIssue(fullRow);
    expect(result.labels).toEqual([{ id: "lbl-1", name: "Bug", color: "#ff0000" }]);
  });

  it("returns empty array when labels not in data", () => {
    const row = { ...fullRow, data: { ...fullRow.data, labels: undefined } };
    const result = mapRowToLinearIssue(row);
    expect(result.labels).toEqual([]);
  });

  it("uses timestamps from data", () => {
    const result = mapRowToLinearIssue(fullRow);
    expect(result.createdAt).toBe("2026-02-20T10:00:00.000Z");
    expect(result.updatedAt).toBe("2026-02-25T14:30:00.000Z");
  });

  it("falls back to row timestamps when not in data", () => {
    const row = {
      ...fullRow,
      data: { ...fullRow.data, createdAt: undefined, updatedAt: undefined },
    };
    const result = mapRowToLinearIssue(row);
    expect(result.createdAt).toBe(fullRow.created_at);
    expect(result.updatedAt).toBe(fullRow.updated_at);
  });

  it("defaults description to undefined when not in data", () => {
    const row = { ...fullRow, data: { ...fullRow.data, description: undefined } };
    const result = mapRowToLinearIssue(row);
    expect(result.description).toBeUndefined();
  });

  it("defaults url to empty string when not in data", () => {
    const row = { ...fullRow, data: { ...fullRow.data, url: undefined } };
    const result = mapRowToLinearIssue(row);
    expect(result.url).toBe("");
  });
});

// -- mapRowToComment (JSONB data → comment shape) ----------------------------

describe("mapRowToComment", () => {
  it("maps all fields correctly from data", () => {
    const row = {
      linear_id: "comment-1",
      created_at: "2026-02-25T15:00:00Z",
      updated_at: "2026-02-25T15:05:00Z",
      data: {
        id: "comment-1",
        body: "Looks good!",
        user: { id: "user-1", name: "Alice" },
        createdAt: "2026-02-25T15:00:00Z",
        updatedAt: "2026-02-25T15:05:00Z",
      },
    };
    const result = mapRowToComment(row);

    expect(result.id).toBe("comment-1");
    expect(result.body).toBe("Looks good!");
    expect(result.user).toEqual({ id: "user-1", name: "Alice" });
    expect(result.createdAt).toBe("2026-02-25T15:00:00Z");
  });

  it("defaults body to empty string when not in data", () => {
    const row = {
      linear_id: "c1",
      created_at: "",
      updated_at: "",
      data: { id: "c1", body: undefined, user: { id: "x", name: "X" } },
    };
    expect(mapRowToComment(row).body).toBe("");
  });

  it("defaults author to Unknown when user not in data", () => {
    const row = {
      linear_id: "c1",
      created_at: "",
      updated_at: "",
      data: { id: "c1", body: "hi", user: undefined },
    };
    expect(mapRowToComment(row).user.name).toBe("Unknown");
  });

  it("preserves user.id from data", () => {
    const row = {
      linear_id: "c1",
      created_at: "",
      updated_at: "",
      data: { id: "c1", body: "hi", user: { id: "user-42", name: "Bob" } },
    };
    expect(mapRowToComment(row).user.id).toBe("user-42");
  });
});
