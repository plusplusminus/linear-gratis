"use client";

import { useEffect, useState, useCallback } from "react";
import { ActivityEventItem, type NotificationEvent } from "./activity-event-item";
import { Activity } from "lucide-react";

function groupByDate(events: NotificationEvent[]): Map<string, NotificationEvent[]> {
  const groups = new Map<string, NotificationEvent[]>();
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();

  for (const event of events) {
    const eventDate = new Date(event.created_at).toDateString();
    let label: string;
    if (eventDate === today) {
      label = "Today";
    } else if (eventDate === yesterday) {
      label = "Yesterday";
    } else {
      label = new Date(event.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
    const group = groups.get(label) || [];
    group.push(event);
    groups.set(label, group);
  }

  return groups;
}

export function ActivityFeed({
  hubId,
  hubSlug,
  teamId,
}: {
  hubId: string;
  hubSlug: string;
  teamId?: string;
}) {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchEvents = useCallback(
    async (cursor?: string) => {
      const params = new URLSearchParams();
      if (teamId) params.set("team_id", teamId);
      if (cursor) params.set("cursor", cursor);
      params.set("limit", "20");

      const res = await fetch(
        `/api/hub/${hubId}/notifications?${params.toString()}`
      );
      if (!res.ok) return null;
      return res.json() as Promise<{
        events: NotificationEvent[];
        nextCursor: string | null;
      }>;
    },
    [hubId, teamId]
  );

  useEffect(() => {
    setLoading(true);
    fetchEvents().then((data) => {
      if (data) {
        setEvents(data.events);
        setNextCursor(data.nextCursor);
      }
      setLoading(false);
    });
  }, [fetchEvents]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const data = await fetchEvents(nextCursor);
    if (data) {
      setEvents((prev) => [...prev, ...data.events]);
      setNextCursor(data.nextCursor);
    }
    setLoadingMore(false);
  }

  function handleMarkRead(eventId: string) {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, read: true } : e))
    );
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3 animate-pulse">
            <div className="w-3.5 h-3.5 rounded bg-muted mt-0.5" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-muted rounded w-3/4" />
              <div className="h-2.5 bg-muted rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="border border-border rounded-lg p-10 bg-card text-center">
        <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium mb-1">No activity yet</p>
        <p className="text-xs text-muted-foreground">
          Events will appear here as things happen.
        </p>
      </div>
    );
  }

  const grouped = groupByDate(events);

  return (
    <div>
      {Array.from(grouped.entries()).map(([dateLabel, groupEvents]) => (
        <div key={dateLabel}>
          <div className="px-4 py-1.5 sticky top-0 bg-background/95 backdrop-blur-sm z-10">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {dateLabel}
            </span>
          </div>
          <div className="divide-y divide-border">
            {groupEvents.map((event) => (
              <ActivityEventItem
                key={event.id}
                event={event}
                hubSlug={hubSlug}
                hubId={hubId}
                onMarkRead={handleMarkRead}
              />
            ))}
          </div>
        </div>
      ))}

      {nextCursor && (
        <div className="px-4 py-3 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
