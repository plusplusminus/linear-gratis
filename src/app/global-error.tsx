"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          backgroundColor: "#fff",
          color: "#1a1a1a",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1
            style={{
              fontSize: "1.25rem",
              fontWeight: 500,
              marginBottom: "0.5rem",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#6b7280",
              marginBottom: "1.5rem",
            }}
          >
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              border: "1px solid #d1d5db",
              borderRadius: "0.375rem",
              backgroundColor: "transparent",
              cursor: "pointer",
              color: "#1a1a1a",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
