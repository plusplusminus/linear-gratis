import { supabaseAdmin } from "./supabase"

/**
 * Mark specific notification events as read for a user.
 * Uses upsert with ignoreDuplicates to safely handle re-reads.
 */
export async function markEventsAsRead(userId: string, eventIds: string[]) {
  if (eventIds.length === 0) return

  const rows = eventIds.map((id) => ({
    user_id: userId,
    notification_event_id: id,
  }))

  const { error } = await supabaseAdmin
    .from("notification_reads")
    .upsert(rows, { onConflict: "user_id,notification_event_id", ignoreDuplicates: true })

  if (error) {
    console.error("markEventsAsRead error:", error)
    throw error
  }
}

/**
 * Mark all unread notification events in a hub as read for a user.
 */
export async function markAllAsRead(userId: string, hubId: string) {
  const { data: events } = await supabaseAdmin
    .from("notification_events")
    .select("id")
    .eq("hub_id", hubId)

  if (!events || events.length === 0) return

  const allIds = events.map((e) => e.id)

  const { data: reads } = await supabaseAdmin
    .from("notification_reads")
    .select("notification_event_id")
    .eq("user_id", userId)
    .in("notification_event_id", allIds)

  const readSet = new Set((reads || []).map((r) => r.notification_event_id))
  const unreadIds = allIds.filter((id) => !readSet.has(id))

  if (unreadIds.length > 0) {
    await markEventsAsRead(userId, unreadIds)
  }
}

/**
 * Get the count of unread notification events for a user in a hub.
 */
export async function getUnreadCount(userId: string, hubId: string): Promise<number> {
  const { count: totalCount, error: totalError } = await supabaseAdmin
    .from("notification_events")
    .select("id", { count: "exact", head: true })
    .eq("hub_id", hubId)

  if (totalError || totalCount === null) {
    console.error("getUnreadCount total error:", totalError)
    return 0
  }

  if (totalCount === 0) return 0

  // Count how many the user has read in this hub
  // Join through notification_event_id → notification_events.hub_id
  const { data: readEvents } = await supabaseAdmin
    .from("notification_reads")
    .select("notification_event_id, notification_events!inner(hub_id)")
    .eq("user_id", userId)
    .eq("notification_events.hub_id", hubId)

  const readCount = readEvents?.length ?? 0
  return totalCount - readCount
}
