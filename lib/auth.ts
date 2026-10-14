// ============================================================
// SeaSentry Authentication
// ============================================================
// Client-side helpers for the real backend-backed auth flow.
// The JWT lives in an httpOnly cookie set by the /api/auth/*
// route handlers and is never exposed to client JS. The session
// state itself (checking / authenticated / unauthenticated /
// unavailable) lives in lib/session.tsx; the user returned from
// these helpers is handed to it via acceptUser().
// ============================================================

export const AUTH_STORAGE_KEY = "seasentry-auth";
export const USER_STORAGE_KEY = "seasentry-user";
export const AUTH_COOKIE_NAME = "seasentry_token";

export type UserRole = "viewer" | "operator" | "admin";

export type AuthUser = {
  name: string;
  email: string;
  role: UserRole;
  isDemo: boolean;
};

/** Anyone at "viewer" (including the demo account) can browse but not
 * create/decide incidents, generate reports, etc. */
export function canOperate(user: AuthUser | null): boolean {
  return user?.role === "operator" || user?.role === "admin";
}

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === "admin";
}

/** Keys into translations.auth so callers can show localized messages. */
export type AuthValidationKey = "emailRequired" | "invalidEmail" | "passwordRequired" | "passwordTooShort" | "fullNameRequired" | "passwordsDoNotMatch";

/** "network" means the request never got a usable answer and can be retried
 * as-is; "rejected" carries the server's own message (wrong password, taken
 * email, expired code…). */
export type AuthFailure = { kind: "network" } | { kind: "rejected"; message: string | null; status: number };

export type AuthResult = { ok: true; user: AuthUser } | { ok: false; failure: AuthFailure };

/** Login can pause on an emailed 2FA code for admin accounts. */
export type LoginResult =
  | { status: "success"; user: AuthUser }
  | { status: "twoFactorRequired"; challengeId: string }
  | { status: "error"; failure: AuthFailure };

export function validateEmail(email: string): AuthValidationKey | null {
  const value = email.trim();
  if (!value) return "emailRequired";
  // Practical client-side check — not a security boundary.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "invalidEmail";
  return null;
}

export function validatePassword(password: string): AuthValidationKey | null {
  if (!password) return "passwordRequired";
  if (password.length < 8) return "passwordTooShort";
  return null;
}

async function rejected(res: Response): Promise<AuthFailure> {
  try {
    const data = await res.json();
    return { kind: "rejected", message: typeof data?.error === "string" ? data.error : null, status: res.status };
  } catch {
    return { kind: "rejected", message: null, status: res.status };
  }
}

async function postJson(url: string, body?: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

type SessionPayload = { requiresTwoFactor?: boolean; challengeId?: string; user?: AuthUser };

async function sessionResult(res: Response): Promise<LoginResult> {
  // A 5xx is the proxy or backend being unavailable, not a verdict on the input.
  if (res.status >= 500) return { status: "error", failure: { kind: "network" } };
  if (!res.ok) return { status: "error", failure: await rejected(res) };
  const data = (await res.json()) as SessionPayload;
  if (data.requiresTwoFactor && data.challengeId) return { status: "twoFactorRequired", challengeId: data.challengeId };
  if (!data.user) return { status: "error", failure: { kind: "network" } };
  return { status: "success", user: data.user };
}

export async function login(email: string, password: string, remember = false): Promise<LoginResult> {
  try {
    return await sessionResult(await postJson("/api/auth/login", { email: email.trim(), password, remember }));
  } catch {
    return { status: "error", failure: { kind: "network" } };
  }
}

/** Completes an admin login after the 6-digit email code. `remember` must be
 * passed again since this is a separate request from the password step. */
export async function verifyTwoFactor(challengeId: string, code: string, remember = false): Promise<LoginResult> {
  try {
    return await sessionResult(await postJson("/api/auth/verify-2fa", { challengeId, code: code.trim(), remember }));
  } catch {
    return { status: "error", failure: { kind: "network" } };
  }
}

export async function register(fullName: string, email: string, password: string, turnstileToken: string): Promise<LoginResult> {
  try {
    return await sessionResult(await postJson("/api/auth/register", { name: fullName.trim(), email: email.trim(), password, turnstileToken }));
  } catch {
    return { status: "error", failure: { kind: "network" } };
  }
}

/** Signs in as the fixed public demo account (viewer role). */
export async function loginAsDemo(): Promise<AuthResult> {
  try {
    const result = await sessionResult(await postJson("/api/auth/demo"));
    return result.status === "success" ? { ok: true, user: result.user } : { ok: false, failure: result.status === "error" ? result.failure : { kind: "network" } };
  } catch {
    return { ok: false, failure: { kind: "network" } };
  }
}
