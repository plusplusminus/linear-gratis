import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/admin-auth";
import { getWorkspaceToken } from "@/lib/workspace";

// GET: Fetch workspace-level (global) labels from Linear API
export async function GET() {
  try {
    const auth = await withAdminAuth();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const token = await getWorkspaceToken();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    let res: Response;
    try {
      res = await fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({
          query: `
            query WorkspaceLabels {
              issueLabels(filter: { team: { null: true } }, first: 250) {
                nodes {
                  id
                  name
                  color
                }
              }
            }
          `,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return NextResponse.json(
          { error: "Linear API request timed out" },
          { status: 504 }
        );
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    const result = (await res.json()) as {
      data?: {
        issueLabels?: {
          nodes: Array<{ id: string; name: string; color: string }>;
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (result.errors || !result.data?.issueLabels) {
      console.error("Linear workspace labels query error:", {
        errors: result.errors,
        hasData: !!result.data,
        httpStatus: res.status,
      });
      return NextResponse.json(
        {
          error: "Failed to fetch labels from Linear",
          detail: result.errors?.[0]?.message,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(result.data.issueLabels.nodes);
  } catch (error) {
    console.error("GET /api/admin/linear/labels error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
