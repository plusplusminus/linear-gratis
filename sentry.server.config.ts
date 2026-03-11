import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,

  // Performance: 100% in dev, 20% in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.2,

  // Only send events in production/preview
  enabled: process.env.NODE_ENV !== "development" || !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
