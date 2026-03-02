import { createElement } from "react";
import { supabaseAdmin } from "@/lib/supabase";
import { getPreferencesForUser } from "@/lib/notification-preferences";
import { sendEmail } from "@/lib/email";
import { ImmediateNotification } from "@/emails/immediate-notification";

function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

// -- Types -------------------------------------------------------------------

type NotificationEvent = {
  id: string;
  hub_id: string;
  team_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor_name: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type HubMember = {
  user_id: string | null;
  email: string | null;
  role: string;
};

type HubInfo = {
  name: string;
  slug: string;
};

// -- Deep link construction --------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildDeepLinkUrl(hubSlug: string, _entityType: string, _entityId: string): string {
  // Deep links go to the hub's main page — entity-specific routing
  // would need team key which we don't always have in the event.
  // Hub landing is the safest default.
  return `${getAppUrl()}/hub/${hubSlug}`;
}

// -- Fetch helpers -----------------------------------------------------------

async function fetchNotificationEvent(eventId: string): Promise<NotificationEvent | null> {
  const { data, error } = await supabaseAdmin
    .from("notification_events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error || !data) return null;
  return data as NotificationEvent;
}

async function fetchHubInfo(hubId: string): Promise<HubInfo | null> {
  const { data, error } = await supabaseAdmin
    .from("client_hubs")
    .select("name, slug")
    .eq("id", hubId)
    .single();

  if (error || !data) return null;
  return data as HubInfo;
}

async function fetchHubMembers(hubId: string): Promise<HubMember[]> {
  const { data, error } = await supabaseAdmin
    .from("hub_members")
    .select("user_id, email, role")
    .eq("hub_id", hubId);

  if (error) {
    console.error("fetchHubMembers error:", error);
    return [];
  }

  return (data ?? []) as HubMember[];
}

// -- Queue management --------------------------------------------------------

async function insertQueueRow(params: {
  eventId: string;
  userId: string;
  hubId: string;
  email: string;
}): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("notification_email_queue")
    .insert({
      notification_event_id: params.eventId,
      user_id: params.userId,
      hub_id: params.hubId,
      email_address: params.email,
      status: "pending",
      is_digest: false,
      attempts: 0,
    })
    .select("id")
    .single();

  if (error) {
    console.error("insertQueueRow error:", error);
    return null;
  }

  return data?.id ?? null;
}

async function markQueueSent(queueId: string, resendMessageId: string): Promise<void> {
  await supabaseAdmin
    .from("notification_email_queue")
    .update({
      status: "sent",
      resend_message_id: resendMessageId,
      sent_at: new Date().toISOString(),
      attempts: 1,
    })
    .eq("id", queueId);
}

async function markQueueFailed(queueId: string, errorMessage: string, attempts: number): Promise<void> {
  await supabaseAdmin
    .from("notification_email_queue")
    .update({
      status: "failed",
      error_message: errorMessage,
      attempts,
    })
    .eq("id", queueId);
}

// -- Email sending -----------------------------------------------------------

async function sendNotificationEmail(params: {
  email: string;
  event: NotificationEvent;
  hub: HubInfo;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { email, event, hub } = params;
  const deepLinkUrl = buildDeepLinkUrl(hub.slug, event.entity_type, event.entity_id);

  const element = createElement(ImmediateNotification, {
    hubName: hub.name,
    hubSlug: hub.slug,
    event: {
      type: event.event_type,
      summary: event.summary,
      entityType: event.entity_type,
      entityId: event.entity_id,
      actorName: event.actor_name ?? undefined,
      metadata: event.metadata as Record<string, string>,
    },
    deepLinkUrl,
  });

  return sendEmail({
    to: email,
    subject: `${event.summary} — ${hub.name}`,
    react: element,
  });
}

// -- Main entry point --------------------------------------------------------

/**
 * Process immediate email delivery for a notification event.
 * Checks each hub member's preferences and sends emails to those
 * with email_mode='immediate' for this event type.
 *
 * Fire-and-forget: catches all errors internally, never throws.
 */
export async function processImmediateEmails(
  hubId: string,
  eventId: string,
  eventType: string
): Promise<void> {
  try {
    const [event, hub, members] = await Promise.all([
      fetchNotificationEvent(eventId),
      fetchHubInfo(hubId),
      fetchHubMembers(hubId),
    ]);

    if (!event || !hub) {
      console.error("processImmediateEmails: event or hub not found", { eventId, hubId });
      return;
    }

    // Filter to members with both user_id and email
    const eligibleMembers = members.filter(
      (m): m is HubMember & { user_id: string; email: string } =>
        m.user_id !== null && m.email !== null
    );

    if (eligibleMembers.length === 0) return;

    // Check preferences and send in parallel
    await Promise.all(
      eligibleMembers.map(async (member) => {
        try {
          const prefs = await getPreferencesForUser(hubId, member.user_id);
          const pref = prefs.find((p) => p.event_type === eventType);

          // Only send if email_mode is 'immediate'
          if (!pref || pref.email_mode !== "immediate") return;

          // Insert queue row
          const queueId = await insertQueueRow({
            eventId,
            userId: member.user_id,
            hubId,
            email: member.email,
          });

          if (!queueId) return;

          // Send email
          const result = await sendNotificationEmail({
            email: member.email,
            event,
            hub,
          });

          if (result.success && result.messageId) {
            await markQueueSent(queueId, result.messageId);
          } else {
            await markQueueFailed(queueId, result.error ?? "Unknown send error", 1);
          }
        } catch (err) {
          console.error("processImmediateEmails: error processing member", member.user_id, err);
        }
      })
    );
  } catch (error) {
    console.error("processImmediateEmails: unexpected error:", error);
  }
}

// -- Retry failed emails (for cron) ------------------------------------------

/**
 * Retry failed email queue entries with attempts < maxAttempts.
 * Returns count of retried/succeeded.
 */
export async function retryFailedEmails(maxAttempts = 3): Promise<{ retried: number; succeeded: number }> {
  const { data: failedRows, error } = await supabaseAdmin
    .from("notification_email_queue")
    .select("id, notification_event_id, user_id, hub_id, email_address, attempts")
    .eq("status", "failed")
    .lt("attempts", maxAttempts)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error || !failedRows || failedRows.length === 0) {
    return { retried: 0, succeeded: 0 };
  }

  let succeeded = 0;

  await Promise.all(
    failedRows.map(async (row) => {
      try {
        const [event, hub] = await Promise.all([
          fetchNotificationEvent(row.notification_event_id),
          fetchHubInfo(row.hub_id),
        ]);

        if (!event || !hub) {
          await markQueueFailed(row.id, "Event or hub not found on retry", row.attempts + 1);
          return;
        }

        const result = await sendNotificationEmail({
          email: row.email_address,
          event,
          hub,
        });

        if (result.success && result.messageId) {
          await markQueueSent(row.id, result.messageId);
          succeeded++;
        } else {
          await markQueueFailed(row.id, result.error ?? "Unknown send error", row.attempts + 1);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await markQueueFailed(row.id, message, row.attempts + 1);
      }
    })
  );

  return { retried: failedRows.length, succeeded };
}
