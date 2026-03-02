import { NextResponse } from "next/server"
import { withHubAuth, type HubAuthError } from "@/lib/hub-auth"
import { getUnreadCount } from "@/lib/notification-read"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hubId: string }> }
) {
  try {
    const { hubId } = await params

    const auth = await withHubAuth(hubId)
    if ("error" in auth) {
      return NextResponse.json(
        { error: (auth as HubAuthError).error },
        { status: (auth as HubAuthError).status }
      )
    }

    const count = await getUnreadCount(auth.user.id, hubId)

    return NextResponse.json({ count })
  } catch (error) {
    console.error("GET /api/hub/[hubId]/notifications/unread-count error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
