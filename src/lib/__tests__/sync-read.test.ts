import { describe, it, expect } from "vitest";
import {
  priorityToLabel,
  mapRowToLinearIssue,
  mapRowToComment,
  mapRowToTeam,
  mapRowToProject,
  mapRowToInitiative,
} from "../sync-read";

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

// -- mapRowToTeam (JSONB data → team shape) ----------------------------------

describe("mapRowToTeam", () => {
  const fullRow = {
    linear_id: "team-uuid-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-02-25T14:30:00.000Z",
    data: {
      id: "team-uuid-1",
      name: "Engineering",
      displayName: "Eng Team",
      key: "ENG",
      description: "The engineering team",
      icon: "code",
      color: "#0066ff",
      private: false,
      parent: { id: "team-parent-1", name: "Product", key: "PROD" },
      children: [{ id: "team-child-1" }, { id: "team-child-2" }],
      members: [{ id: "user-1", name: "Alice" }, { id: "user-2", name: "Bob" }],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-02-25T14:30:00.000Z",
    },
  };

  it("maps id from data", () => {
    expect(mapRowToTeam(fullRow).id).toBe("team-uuid-1");
  });

  it("preserves name, displayName, key", () => {
    const result = mapRowToTeam(fullRow);
    expect(result.name).toBe("Engineering");
    expect(result.displayName).toBe("Eng Team");
    expect(result.key).toBe("ENG");
  });

  it("preserves parent object", () => {
    expect(mapRowToTeam(fullRow).parent).toEqual({ id: "team-parent-1", name: "Product", key: "PROD" });
  });

  it("preserves children and members arrays", () => {
    const result = mapRowToTeam(fullRow);
    expect(result.children).toHaveLength(2);
    expect(result.members).toHaveLength(2);
    expect(result.members[0]).toEqual({ id: "user-1", name: "Alice" });
  });

  it("defaults displayName to name when not in data", () => {
    const row = { ...fullRow, data: { ...fullRow.data, displayName: undefined } };
    expect(mapRowToTeam(row).displayName).toBe("Engineering");
  });

  it("defaults children and members to empty arrays when not in data", () => {
    const row = { ...fullRow, data: { ...fullRow.data, children: undefined, members: undefined } };
    const result = mapRowToTeam(row);
    expect(result.children).toEqual([]);
    expect(result.members).toEqual([]);
  });

  it("defaults private to false when not in data", () => {
    const row = { ...fullRow, data: { ...fullRow.data, private: undefined } };
    expect(mapRowToTeam(row).private).toBe(false);
  });

  it("falls back to row timestamps when not in data", () => {
    const row = { ...fullRow, data: { ...fullRow.data, createdAt: undefined, updatedAt: undefined } };
    const result = mapRowToTeam(row);
    expect(result.createdAt).toBe(fullRow.created_at);
    expect(result.updatedAt).toBe(fullRow.updated_at);
  });
});

// -- mapRowToProject (JSONB data → project shape) ----------------------------

describe("mapRowToProject", () => {
  const fullRow = {
    linear_id: "project-uuid-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-02-25T14:30:00.000Z",
    data: {
      id: "project-uuid-1",
      name: "Q1 Sprint",
      description: "Our Q1 goals",
      icon: "rocket",
      color: "#ff6600",
      url: "https://linear.app/team/project/q1",
      priority: 2,
      priorityLabel: "High",
      progress: 0.45,
      health: "atRisk",
      startDate: "2026-01-01",
      targetDate: "2026-03-31",
      status: { id: "status-1", name: "In Progress", color: "#00ff00", type: "started" },
      lead: { id: "user-1", name: "Alice" },
      teams: [{ id: "team-1", name: "Engineering", key: "ENG" }],
      initiatives: [{ id: "init-1", name: "Revenue Growth" }],
      milestones: [{ id: "ms-1", name: "MVP", targetDate: "2026-02-15" }],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-02-25T14:30:00.000Z",
    },
  };

  it("maps id from data", () => {
    expect(mapRowToProject(fullRow).id).toBe("project-uuid-1");
  });

  it("preserves all scalar fields", () => {
    const result = mapRowToProject(fullRow);
    expect(result.name).toBe("Q1 Sprint");
    expect(result.description).toBe("Our Q1 goals");
    expect(result.url).toBe("https://linear.app/team/project/q1");
    expect(result.priority).toBe(2);
    expect(result.priorityLabel).toBe("High");
    expect(result.progress).toBe(0.45);
    expect(result.health).toBe("atRisk");
    expect(result.startDate).toBe("2026-01-01");
    expect(result.targetDate).toBe("2026-03-31");
  });

  it("preserves full status object", () => {
    expect(mapRowToProject(fullRow).status).toEqual({
      id: "status-1",
      name: "In Progress",
      color: "#00ff00",
      type: "started",
    });
  });

  it("preserves lead object", () => {
    expect(mapRowToProject(fullRow).lead).toEqual({ id: "user-1", name: "Alice" });
  });

  it("preserves teams, initiatives, milestones arrays", () => {
    const result = mapRowToProject(fullRow);
    expect(result.teams).toEqual([{ id: "team-1", name: "Engineering", key: "ENG" }]);
    expect(result.initiatives).toEqual([{ id: "init-1", name: "Revenue Growth" }]);
    expect(result.milestones).toEqual([{ id: "ms-1", name: "MVP", targetDate: "2026-02-15" }]);
  });

  it("defaults status to Unknown when not in data", () => {
    const row = { ...fullRow, data: { ...fullRow.data, status: undefined } };
    expect(mapRowToProject(row).status).toEqual({ id: "", name: "Unknown", color: "", type: "" });
  });

  it("defaults lead to undefined when not in data", () => {
    const row = { ...fullRow, data: { ...fullRow.data, lead: undefined } };
    expect(mapRowToProject(row).lead).toBeUndefined();
  });

  it("defaults arrays to empty when not in data", () => {
    const row = {
      ...fullRow,
      data: { ...fullRow.data, teams: undefined, initiatives: undefined, milestones: undefined },
    };
    const result = mapRowToProject(row);
    expect(result.teams).toEqual([]);
    expect(result.initiatives).toEqual([]);
    expect(result.milestones).toEqual([]);
  });

  it("falls back to computed priorityLabel when not in data", () => {
    const row = { ...fullRow, data: { ...fullRow.data, priorityLabel: undefined, priority: 1 } };
    expect(mapRowToProject(row).priorityLabel).toBe("Urgent");
  });

  it("defaults priority to 0 when not in data", () => {
    const row = { ...fullRow, data: { ...fullRow.data, priority: undefined, priorityLabel: undefined } };
    const result = mapRowToProject(row);
    expect(result.priority).toBe(0);
    expect(result.priorityLabel).toBe("No priority");
  });
});

// -- mapRowToInitiative (JSONB data → initiative shape) ----------------------

describe("mapRowToInitiative", () => {
  const fullRow = {
    linear_id: "init-uuid-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-02-25T14:30:00.000Z",
    data: {
      id: "init-uuid-1",
      name: "Revenue Growth",
      description: "Double ARR by EOY",
      icon: "chart",
      color: "#ff0066",
      url: "https://linear.app/team/initiative/revenue",
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
    },
  };

  it("maps id from data", () => {
    expect(mapRowToInitiative(fullRow).id).toBe("init-uuid-1");
  });

  it("preserves all scalar fields", () => {
    const result = mapRowToInitiative(fullRow);
    expect(result.name).toBe("Revenue Growth");
    expect(result.description).toBe("Double ARR by EOY");
    expect(result.url).toBe("https://linear.app/team/initiative/revenue");
    expect(result.status).toBe("Active");
    expect(result.health).toBe("onTrack");
    expect(result.healthUpdatedAt).toBe("2026-02-20T10:00:00.000Z");
    expect(result.targetDate).toBe("2026-12-31");
  });

  it("preserves owner object", () => {
    expect(mapRowToInitiative(fullRow).owner).toEqual({ id: "user-1", name: "Alice" });
  });

  it("preserves projects and subInitiatives arrays", () => {
    const result = mapRowToInitiative(fullRow);
    expect(result.projects).toEqual([{ id: "project-1", name: "Q1 Sprint" }]);
    expect(result.subInitiatives).toEqual([{ id: "init-2", name: "Enterprise Sales" }]);
  });

  it("preserves parentInitiative object", () => {
    expect(mapRowToInitiative(fullRow).parentInitiative).toEqual({ id: "init-0", name: "Company Goals" });
  });

  it("defaults status to Planned when not in data", () => {
    const row = { ...fullRow, data: { ...fullRow.data, status: undefined } };
    expect(mapRowToInitiative(row).status).toBe("Planned");
  });

  it("defaults owner to undefined when not in data", () => {
    const row = { ...fullRow, data: { ...fullRow.data, owner: undefined } };
    expect(mapRowToInitiative(row).owner).toBeUndefined();
  });

  it("defaults arrays to empty when not in data", () => {
    const row = {
      ...fullRow,
      data: { ...fullRow.data, projects: undefined, subInitiatives: undefined },
    };
    const result = mapRowToInitiative(row);
    expect(result.projects).toEqual([]);
    expect(result.subInitiatives).toEqual([]);
  });

  it("defaults parentInitiative to undefined when not in data", () => {
    const row = { ...fullRow, data: { ...fullRow.data, parentInitiative: undefined } };
    expect(mapRowToInitiative(row).parentInitiative).toBeUndefined();
  });

  it("falls back to row timestamps when not in data", () => {
    const row = { ...fullRow, data: { ...fullRow.data, createdAt: undefined, updatedAt: undefined } };
    const result = mapRowToInitiative(row);
    expect(result.createdAt).toBe(fullRow.created_at);
    expect(result.updatedAt).toBe(fullRow.updated_at);
  });
});
