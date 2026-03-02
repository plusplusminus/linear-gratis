import { NextResponse } from "next/server"
import { withHubAuth, type HubAuthError } from "@/lib/hub-auth"
import { markEventsAsRead, markAllAsRead } from "@/lib/notification-read"

export async function POST(
  request: Request,
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

    const body = (await request.json()) as {
      eventIds?: string[]
      all?: boolean
    }

    if (body.all) {
      await markAllAsRead(auth.user.id, hubId)
    } else if (body.eventIds && Array.isArray(body.eventIds) && body.eventIds.length > 0) {
      await markEventsAsRead(auth.user.id, body.eventIds)
    } else {
      return NextResponse.json(
        { error: "Provide eventIds array or { all: true }" },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("POST /api/hub/[hubId]/notifications/mark-read error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
