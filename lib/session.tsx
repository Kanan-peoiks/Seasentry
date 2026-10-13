"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AUTH_STORAGE_KEY, USER_STORAGE_KEY, type AuthUser } from "@/lib/auth";

export type SessionStatus = "checking" | "authenticated" | "unauthenticated" | "unavailable";

type SessionValue = {
  status: SessionStatus;
  /** Only a server-verified user is exposed here; cached roles never grant access. */
  user: AuthUser | null;
  refresh: () => Promise<AuthUser | null>;
  signOut: () => Promise<boolean>;
  acceptUser: (user: AuthUser) => void;
};

const SessionContext = createContext<SessionValue | null>(null);
const WORKSPACE_PATHS = ["/dashboard", "/incidents", "/vessels", "/ai-analysis", "/response", "/reports", "/account", "/admin"];

export function isWorkspacePath(pathname: string): boolean {
  return WORKSPACE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function cacheUser(user: AuthUser | null) {
  try {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, "true");
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch {
    // Storage is optional. The httpOnly cookie remains the session source of truth.
  }
}

function parseUser(value: unknown): AuthUser | null {
  if (!value || typeof value !== "object") return null;
  const user = value as Record<string, unknown>;
  if (typeof user.name !== "string" || typeof user.email !== "string" || !["viewer", "operator", "admin"].includes(String(user.role))) return null;
  return { name: user.name, email: user.email, role: user.role as AuthUser["role"], isDemo: user.isDemo === true };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<SessionStatus>("checking");
  const [user, setUser] = useState<AuthUser | null>(null);
  const userRef = useRef<AuthUser | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const revisionRef = useRef(0);

  const acceptUser = useCallback((nextUser: AuthUser) => {
    revisionRef.current += 1;
    requestRef.current?.abort();
    userRef.current = nextUser;
    cacheUser(nextUser);
    setUser(nextUser);
    setStatus("authenticated");
  }, []);

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const revision = ++revisionRef.current;
    if (!userRef.current) setStatus("checking");

    try {
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(70_000)]),
      });
      if (revision !== revisionRef.current) return null;
      if (response.status === 401) {
        // Remove an invalid cookie before /login can redirect back through proxy.ts.
        const cleared = await fetch("/api/auth/logout", { method: "POST", signal: controller.signal });
        if (!cleared.ok) throw new Error("Session cookie could not be cleared");
        if (revision !== revisionRef.current) return null;
        cacheUser(null);
        userRef.current = null;
        setUser(null);
        setStatus("unauthenticated");
        return null;
      }
      if (!response.ok) throw new Error("Session service unavailable");
      const data: unknown = await response.json();
      const nextUser = parseUser(data && typeof data === "object" ? (data as Record<string, unknown>).user : null);
      if (!nextUser) throw new Error("Invalid session response");
      if (revision !== revisionRef.current) return null;
      cacheUser(nextUser);
      userRef.current = nextUser;
      setUser(nextUser);
      setStatus("authenticated");
      return nextUser;
    } catch {
      if (revision !== revisionRef.current || controller.signal.aborted) return null;
      // A verified session survives a transient outage during navigation;
      // only a first check without any verified user becomes "unavailable".
      if (userRef.current) return userRef.current;
      userRef.current = null;
      setUser(null);
      setStatus("unavailable");
      return null;
    }
  }, []);

  const signOut = useCallback(async (): Promise<boolean> => {
    requestRef.current?.abort();
    const revision = ++revisionRef.current;
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", signal: AbortSignal.timeout(15_000) });
      if (!response.ok || revision !== revisionRef.current) return false;
      cacheUser(null);
      userRef.current = null;
      setUser(null);
      setStatus("unauthenticated");
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!isWorkspacePath(pathname)) return;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void refresh(); });
    return () => { cancelled = true; };
  }, [pathname, refresh]);

  useEffect(() => {
    const syncSession = (event: StorageEvent) => {
      if ((event.key === AUTH_STORAGE_KEY || event.key === USER_STORAGE_KEY || event.key === null) && isWorkspacePath(window.location.pathname)) void refresh();
    };
    window.addEventListener("storage", syncSession);
    return () => {
      revisionRef.current += 1;
      requestRef.current?.abort();
      window.removeEventListener("storage", syncSession);
    };
  }, [refresh]);

  const value = useMemo(() => ({ status, user, refresh, signOut, acceptUser }), [status, user, refresh, signOut, acceptUser]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used within SessionProvider");
  return session;
}
