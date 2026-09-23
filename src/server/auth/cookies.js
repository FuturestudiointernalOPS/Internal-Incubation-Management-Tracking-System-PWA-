/**
 * server/auth — cookies.
 *
 * Everything that reads or writes the session cookie, plus the durations that
 * decide how long a session lives. Keeping it in one module means the cookie's
 * security attributes are stated once, where they can be tested.
 *
 * The cookie is the only credential the browser holds:
 *   httpOnly     — never readable from JavaScript, so XSS cannot exfiltrate it;
 *   sameSite=lax — not sent on cross-site requests;
 *   secure       — production only, so local http development still works;
 *   domain       — only for a real hostname (never localhost, an IP or a
 *                  single-label host, where a domain attribute breaks it).
 */

import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "impactos_session";
export const SESSION_DURATION_HOURS = 24;
export const REMEMBER_ME_DURATION_HOURS = 720; // 30 days
export const SESSION_DURATION_MS = SESSION_DURATION_HOURS * 60 * 60 * 1000;
export const REMEMBER_ME_DURATION_MS = REMEMBER_ME_DURATION_HOURS * 60 * 60 * 1000;

/** Cookie `maxAge` (seconds) — what the browser is told to keep. */
export function sessionMaxAgeSeconds(rememberMe) {
  return rememberMe ? REMEMBER_ME_DURATION_HOURS * 60 * 60 : SESSION_DURATION_HOURS * 60 * 60;
}

/** Row `expires_at` offset (ms) — what the database is told to accept. */
export function sessionDurationMs(rememberMe) {
  return rememberMe ? REMEMBER_ME_DURATION_MS : SESSION_DURATION_MS;
}

/**
 * The domain to scope the cookie to, or undefined to keep it host-only.
 * Returns undefined for localhost, IPs, single-label hosts and hosts with an
 * underscore — the cases where a `domain` attribute would silently drop it.
 */
export function resolveCookieDomain(host) {
  if (!host) return undefined;

  const hostname = String(host).toLowerCase().split(":")[0]; // strip port
  const isLocalhost = hostname === "localhost" || hostname.endsWith(".localhost");
  const isIp =
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith("[") || hostname.includes("_");

  if (isLocalhost || isIp || !hostname.includes(".")) return undefined;
  return hostname;
}

/** The session token presented by the caller, or null. */
export async function readSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/** Drop the session cookie from the browser. */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Sets the session cookie on a NextResponse. This is more reliable than
 * `cookies().set()` inside a route handler, because the response is what the
 * browser actually reads.
 */
export function setSessionCookieOnResponse(response, token, maxAge, host) {
  const domain = resolveCookieDomain(host);

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
    ...(domain ? { domain } : {}),
  });
  return response;
}
