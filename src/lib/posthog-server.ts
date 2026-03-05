import { PostHog } from 'posthog-node';
import type { PostHogEvent } from './posthog-events';

let posthogClient: PostHog | null = null;

function getPostHogClient(): PostHog | null {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!apiKey || !host) return null;

  if (!posthogClient) {
    posthogClient = new PostHog(apiKey, { host });
  }
  return posthogClient;
}

export function captureServerEvent(
  distinctId: string,
  event: PostHogEvent,
  properties?: Record<string, unknown>
) {
  const client = getPostHogClient();
  if (!client) return;
  client.capture({ distinctId, event, properties });
}

export async function flushPostHog() {
  const client = getPostHogClient();
  if (!client) return;
  await client.flush();
}
