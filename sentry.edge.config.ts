import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,

  // Performance: disabled until Spec 4 enables tracing
  tracesSampleRate: 0,

  // Only send events in production/preview
  enabled: process.env.NODE_ENV !== "development" || !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
