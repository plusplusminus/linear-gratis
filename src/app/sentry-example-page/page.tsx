"use client";

import * as Sentry from "@sentry/nextjs";

export default function SentryExamplePage() {
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1rem" }}>
        Sentry Test Page
      </h1>
      <p style={{ color: "#6b7280", marginBottom: "2rem" }}>
        Use these buttons to verify Sentry is capturing events. Check your Sentry
        dashboard after clicking.
      </p>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <button
          onClick={() => {
            throw new Error("Sentry client test — unhandled throw");
          }}
          style={{
            padding: "0.5rem 1rem",
            border: "1px solid #ef4444",
            borderRadius: "0.375rem",
            color: "#ef4444",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Throw client error
        </button>
        <button
          onClick={() => {
            Sentry.captureException(
              new Error("Sentry client test — captureException")
            );
            alert("Sent to Sentry via captureException");
          }}
          style={{
            padding: "0.5rem 1rem",
            border: "1px solid #f59e0b",
            borderRadius: "0.375rem",
            color: "#f59e0b",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          captureException (no crash)
        </button>
        <button
          onClick={async () => {
            try {
              const res = await fetch("/api/sentry-example");
              if (!res.ok) {
                const text = await res.text();
                alert(`Server error ${res.status}: ${text}`);
                return;
              }
              const data = await res.json();
              alert(JSON.stringify(data));
            } catch (err) {
              alert(`Fetch failed: ${err instanceof Error ? err.message : err}`);
            }
          }}
          style={{
            padding: "0.5rem 1rem",
            border: "1px solid #3b82f6",
            borderRadius: "0.375rem",
            color: "#3b82f6",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Trigger server error
        </button>
      </div>
    </div>
  );
}
