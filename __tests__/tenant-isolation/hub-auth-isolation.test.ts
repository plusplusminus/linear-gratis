/**
 * Tenant Isolation Tests — Hub Auth & Role Enforcement
 *
 * Verifies that hub-auth.ts correctly enforces membership and roles.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  HUB_1,
  HUB_2,
  USER_HUB1,
  USER_HUB2,
  PPM_ADMIN,
  MEMBER_HUB1_DEFAULT,
  MEMBER_HUB1_VIEWONLY,
  MEMBER_HUB2_DEFAULT,
} from "./test-helpers";

// Mock withAuth
let mockUser: { id: string; email: string } | null = null;
vi.mock("@workos-inc/authkit-nextjs", () => ({
  withAuth: vi.fn(async () => ({ user: mockUser })),
}));

// Mock ppm-admin
let mockAdminIds: string[] = [];
vi.mock("@/lib/ppm-admin", () => ({
  isPPMAdmin: vi.fn(async (userId: string) => mockAdminIds.includes(userId)),
}));

// Mock supabase
const allMembers = [
  MEMBER_HUB1_DEFAULT,
  MEMBER_HUB1_VIEWONLY,
  MEMBER_HUB2_DEFAULT,
];

const allHubs = [HUB_1, HUB_2];

vi.mock("@/lib/supabase", () => {
  return {
    supabaseAdmin: {
      from: (table: string) => {
        const filters: Record<string, unknown> = {};
        const chain = {
          select: vi.fn(() => chain),
          eq: vi.fn((col: string, val: unknown) => {
            filters[col] = val;
            return chain;
          }),
          is: vi.fn((col: string, _val: unknown) => {
            filters[`${col}__is`] = true;
            return chain;
          }),
          single: vi.fn(() => {
            if (table === "hub_members") {
              const member = allMembers.find((m) => {
                if (filters["hub_id"] && m.hub_id !== filters["hub_id"])
                  return false;
                if (filters["user_id"] && m.user_id !== filters["user_id"])
                  return false;
                if (filters["email"] && m.email !== filters["email"])
                  return false;
                if (filters["user_id__is"]) {
                  // is(user_id, null) — looking for unclaimed invites
                  if (m.user_id !== null) return false;
                }
                return true;
              });
              return Promise.resolve({
                data: member ?? null,
                error: member ? null : { code: "PGRST116" },
              });
            }
            if (table === "client_hubs") {
              const hub = allHubs.find((h) => {
                if (filters["id"] && h.id !== filters["id"]) return false;
                if (filters["slug"] && h.slug !== filters["slug"])
                  return false;
                return true;
              });
              return Promise.resolve({
                data: hub ?? null,
                error: hub ? null : { code: "PGRST116" },
              });
            }
            return Promise.resolve({ data: null, error: null });
          }),
          update: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ error: null })),
          })),
        };
        return chain;
      },
    },
  };
});

const {
  getHubMembership,
  withHubAuth,
  withHubAuthWrite,
} = await import("@/lib/hub-auth");

describe("Hub Auth — Tenant Isolation", () => {
  beforeEach(() => {
    mockUser = null;
    mockAdminIds = [];
  });

  describe("getHubMembership", () => {
    it("User in Hub 1 gets membership for Hub 1", async () => {
      const result = await getHubMembership(HUB_1.id, USER_HUB1.id);
      expect(result).not.toBeNull();
      expect(result!.role).toBe("default");
    });

    it("User in Hub 1 does NOT get membership for Hub 2", async () => {
      const result = await getHubMembership(HUB_2.id, USER_HUB1.id);
      expect(result).toBeNull();
    });

    it("User in Hub 2 does NOT get membership for Hub 1", async () => {
      const result = await getHubMembership(HUB_1.id, USER_HUB2.id);
      expect(result).toBeNull();
    });
  });

  describe("withHubAuth", () => {
    it("Returns 401 for unauthenticated requests", async () => {
      mockUser = null;
      const result = await withHubAuth(HUB_1.id);
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.status).toBe(401);
      }
    });

    it("Returns user + role for valid hub member", async () => {
      mockUser = USER_HUB1;
      const result = await withHubAuth(HUB_1.id);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.role).toBe("default");
        expect(result.user.id).toBe(USER_HUB1.id);
      }
    });

    it("Returns 403 for non-member accessing a hub", async () => {
      mockUser = USER_HUB1; // member of Hub 1
      const result = await withHubAuth(HUB_2.id); // trying to access Hub 2
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.status).toBe(403);
      }
    });

    it("PPM admin can access any hub", async () => {
      mockUser = PPM_ADMIN;
      mockAdminIds = [PPM_ADMIN.id];
      const result = await withHubAuth(HUB_1.id);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.role).toBe("admin");
      }
    });

    it("PPM admin can access Hub 2 as well", async () => {
      mockUser = PPM_ADMIN;
      mockAdminIds = [PPM_ADMIN.id];
      const result = await withHubAuth(HUB_2.id);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.role).toBe("admin");
      }
    });

    it("Non-admin PPM user cannot access hubs", async () => {
      mockUser = { id: "random-ppm-user", email: "random@ppm.com" };
      mockAdminIds = []; // not an admin
      const result = await withHubAuth(HUB_1.id);
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.status).toBe(403);
      }
    });

    it("Returns 404 for non-existent hub", async () => {
      mockUser = USER_HUB1;
      const result = await withHubAuth("non-existent-hub-id");
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.status).toBe(404);
      }
    });
  });

  describe("withHubAuthWrite — Role enforcement", () => {
    it("Default user can write", async () => {
      mockUser = USER_HUB1;
      const result = await withHubAuthWrite(HUB_1.id);
      expect("error" in result).toBe(false);
    });

    it("View-only user cannot write", async () => {
      mockUser = {
        id: MEMBER_HUB1_VIEWONLY.user_id!,
        email: MEMBER_HUB1_VIEWONLY.email!,
      };
      const result = await withHubAuthWrite(HUB_1.id);
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.status).toBe(403);
        expect(result.error).toContain("View-only");
      }
    });

    it("PPM admin can always write", async () => {
      mockUser = PPM_ADMIN;
      mockAdminIds = [PPM_ADMIN.id];
      const result = await withHubAuthWrite(HUB_1.id);
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.role).toBe("admin");
      }
    });

    it("View-only user in Hub 1 cannot write to Hub 1", async () => {
      mockUser = {
        id: MEMBER_HUB1_VIEWONLY.user_id!,
        email: MEMBER_HUB1_VIEWONLY.email!,
      };
      const result = await withHubAuthWrite(HUB_1.id);
      expect("error" in result).toBe(true);
    });

    it("Default user in Hub 1 cannot write to Hub 2", async () => {
      mockUser = USER_HUB1;
      const result = await withHubAuthWrite(HUB_2.id);
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.status).toBe(403);
      }
    });
  });
});
