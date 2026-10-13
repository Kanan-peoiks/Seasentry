"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error("Turnstile script failed to load"));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    // Allow a later retry to load the script again.
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

type Props = {
  action: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  /** Script blocked, missing site key or challenge error. Remount the widget
   * (change its `key`) to retry. */
  onError?: () => void;
};

/** Cloudflare Turnstile challenge. The token is verified server-side by
 * app/api/auth/register/route.ts — never trusted client-side. */
export default function TurnstileWidget({ action, onVerify, onExpire, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onVerify, onExpire, onError });

  useEffect(() => { callbacks.current = { onVerify, onExpire, onError }; });

  useEffect(() => {
    let cancelled = false;
    let widgetId: string | null = null;
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!siteKey) {
      queueMicrotask(() => { if (!cancelled) callbacks.current.onError?.(); });
      return () => { cancelled = true; };
    }

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          callback: (token) => callbacks.current.onVerify(token),
          "expired-callback": () => callbacks.current.onExpire?.(),
          "error-callback": () => callbacks.current.onError?.(),
        });
      })
      .catch(() => { if (!cancelled) callbacks.current.onError?.(); });

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [action]);

  return <div ref={containerRef} className="turnstile-slot" />;
}
