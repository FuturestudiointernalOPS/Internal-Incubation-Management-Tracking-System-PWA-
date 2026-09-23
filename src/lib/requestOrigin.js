import { NextResponse } from "next/server";

/**
 * SAME-ORIGIN GUARD — CSRF defence for STATE-CHANGING GET routes.
 *
 * A GET must not change anything, but a handful of administrative maintenance
 * endpoints (seeding, context-grant reconciliation) still do — they were built
 * as GETs and the console calls them that way. Because the session cookie is
 * `SameSite=Lax`, a cookie IS attached to a top-level cross-site navigation: an
 * attacker who can make a logged-in administrator load a link triggers the
 * mutation with the administrator's authority (CSRF-1).
 *
 * The fix here is the minimal one that closes the hole WITHOUT changing the
 * endpoint shape or the console: refuse the request unless it demonstrably
 * originated from this application. This is checked, in order of reliability:
 *
 *   1. `Sec-Fetch-Site` — the browser's own answer. `same-origin` (the app's own
 *      fetch/XHR) and `none` (the user typed the URL) pass; `cross-site` and
 *      `same-site` are refused. `same-site` is refused deliberately: a sibling
 *      subdomain is still a different origin.
 *   2. `Origin` — compared host-to-host with the request's own `Host`. A
 *      browser sends it on cross-origin requests; a mismatch is a forgery.
 *   3. `Referer` — same comparison, for callers that set no `Origin`.
 *   4. No signal at all — a non-browser client (curl, a scheduler). CSRF is a
 *      browser attack and there is no browser here to forge anything, so the
 *      request is allowed through to the route's existing auth gate.
 *
 * Returns true when the request may proceed; `requireSameOrigin` returns a 403
 * NextResponse (or null), a drop-in for the other guards.
 */

function hostOf(value) {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

export function isSameOriginRequest(req) {
  let requestHost = null;
  try {
    const host = req.headers.get("host");
    requestHost = host ? host.toLowerCase() : null;
  } catch (_) {
    requestHost = null;
  }

  let site = null;
  try {
    site = req.headers.get("sec-fetch-site");
  } catch (_) {
    site = null;
  }
  if (site) return site === "same-origin" || site === "none";

  let origin = null;
  try {
    origin = req.headers.get("origin");
  } catch (_) {
    origin = null;
  }
  if (origin) {
    if (origin === "null") return false;
    return Boolean(requestHost) && hostOf(origin) === requestHost;
  }

  let referer = null;
  try {
    referer = req.headers.get("referer");
  } catch (_) {
    referer = null;
  }
  if (referer) return Boolean(requestHost) && hostOf(referer) === requestHost;

  return true;
}

export function requireSameOrigin(req) {
  if (isSameOriginRequest(req)) return null;
  const response = NextResponse.json(
    { success: false, error: "errors.crossSiteRequestBlocked" },
    { status: 403 },
  );
  response.headers.set("X-Authz-Decision", "cross-site");
  return response;
}
