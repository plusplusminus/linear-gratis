import posthog from 'posthog-js';
import type { PostHogEvent } from './posthog-events';

export function captureEvent(
  event: PostHogEvent,
  properties?: Record<string, unknown>
) {
  if (typeof window === 'undefined') return;
  if (!posthog.__loaded) return;
  posthog.capture(event, properties);
}
