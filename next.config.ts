import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare").then(({ initOpenNextCloudflareForDev }) =>
    initOpenNextCloudflareForDev()
  );
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Linear CDN domains (images embedded in comments/descriptions)
      { protocol: "https", hostname: "uploads.linear.app" },
      { protocol: "https", hostname: "linear-uploads.s3.amazonaws.com" },
      { protocol: "https", hostname: "public-files.linear.app" },
      // Supabase Storage (hub comment attachments)
      { protocol: "https", hostname: "kzxhksvvyfpkicodyzdi.supabase.co" },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        url: false,
        punycode: false,
        zlib: false,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        os: false,
        path: false,
      };
    }
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  // Suppress Sentry CLI logs during build
  silent: !process.env.CI,

  // Upload source maps to Sentry (configured in Spec 2)
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },

  // Tunnel Sentry events through our domain to bypass ad blockers
  tunnelRoute: "/api/monitoring",

  // Disable Sentry telemetry
  disableLogger: true,

  // Automatically instrument API routes and server components
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,
  autoInstrumentAppDirectory: true,
});
