"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "#F3F7F9",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: 420,
              width: "100%",
              textAlign: "center",
              background: "#FFFFFF",
              border: "1px solid #D6E2E8",
              borderRadius: 12,
              padding: "32px 28px",
            }}
          >
            <h1 style={{ fontSize: 18, fontWeight: 650, color: "#163147", margin: "0 0 8px" }}>
              SeaSentry failed to load
            </h1>
            <p style={{ fontSize: 13, color: "#526778", lineHeight: 1.55, margin: "0 0 24px" }}>
              A critical error occurred. Please try reloading the page.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                background: "#087F7A",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 8,
                padding: "10px 16px",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
