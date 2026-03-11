import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,

  // Performance: 100% in dev, 20% in production
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.2,

  // Session Replay
  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      maskAllInputs: true,
      blockAllMedia: false,
    }),
  ],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Only send events in production/preview
  enabled: process.env.NODE_ENV !== "development" || !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
