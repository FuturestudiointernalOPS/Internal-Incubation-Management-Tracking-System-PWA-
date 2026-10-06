import { NextResponse } from "next/server";

/**
 * IMPACTOS ROUTE PROTECTION MIDDLEWARE
 *
 * Protects authenticated routes by validating the session cookie.
 * Redirects unauthenticated users to /login.
 *
 * Public routes (no auth required):
 *   - /login
 *   - /forgot-password
 *   - /setup-password/*
 *   - /api/auth/session-login
 *   - /api/auth/session
 *   - /api/auth/forgot-password
 *   - /api/auth/setup-password/*
 *   - /invite/*
 *   - /venture-invite/* (a member invitation link: the token is the credential)
 *   - /register-participant
 *   - /register-staff
 *   - /register/* (a group/family registration link)
 *   - /join/* (a public group join link)
 *   - /verify/* (public certificate verification)
 *   - /api/contacts (POST - registration)
 *   - /api/public/* (group lookup + registration + public course catalogue)
 *   - /api/webhooks/kkiapay (Kkiapay's own payment callback: the provider has
 *     no session, and the x-kkiapay-secret signature is the credential)
 *   - /api/lms/checkout-reconcile (a scheduler's replay of unclosed Kkiapay
 *     payments: the scheduler has no session, and the x-cron-secret shared
 *     secret is the credential — every OTHER /api/lms/* route stays behind a
 *     session)
 *   - /api/platform/scheduled-result-emails (a scheduler's call that releases
 *     the result emails whose delay has elapsed: the scheduler has no session,
 *     and the shared secret is the credential — every OTHER /api/platform/*
 *     route stays behind a session)
 *   - /api/families (the ?registration_id= lookup is the public join path;
 *      every other branch requires a capability in-route)
 *   - /api/verify/* (public certificate verification)
 *   - /api/venture-member-invites/* (validate/accept an invitation)
 *   - /_next/*
 *   - /brand/*
 *   - /favicon.ico
 */

const publicPaths = [
  "/login",
  "/activate",
  "/forgot-password",
  "/setup-password",
  "/invite",
  "/venture-invite",
  "/register-participant",
  "/register-staff",
  "/register",
  "/join",
  "/verify",
  "/investor/setup-password",
  "/s",
  "/_next",
  "/brand",
  "/favicon.ico",
];

const publicApiPaths = [
  "/api/auth/login",
  "/api/auth/session-login",
  "/api/auth/session",
  "/api/auth/activate",
  "/api/auth/forgot-password",
  "/api/auth/setup-password",
  "/api/auth/invite",
  "/api/auth/invite-family",
  "/api/contacts",
  "/api/invites",
  "/api/public",
  "/api/webhooks/kkiapay",
  "/api/lms/checkout-reconcile",
  "/api/platform/scheduled-result-emails",
  "/api/families",
  "/api/verify",
  "/api/venture-member-invites",
  "/api/migrate",
  "/api/s",
  "/api/investor/register",
  "/api/investor/setup-password",
  // Health probes: a load balancer / uptime monitor holds no session cookie.
  // They expose no data (see the routes), only liveness / readiness.
  "/api/health",
  "/api/ready",
];

// Soft-auth paths: let client-side handle auth via localStorage fallback.
// Middleware allows these through without a cookie; if truly unauthenticated,
// the route handler's requireAuth() call will return 401.
// Includes /api/participant and /api/notifications so routes with their own
// requireAuth() check can handle auth themselves instead of being blocked here.
const softAuthPaths = [
  "/participant",
  "/api/participant",
  "/api/notifications",
  "/api/dashboard",
  "/api/engineering",
  "/api/user-groups",
  "/api/migrate",
  "/finance",
  "/api/finance",
];

// Static assets served from /public: a single root segment carrying a file
// extension (manifest.json, favicon.ico, icons, robots.txt…). They are public by
// nature and must never be answered with the login HTML. Without this guard an
// anonymous request to /manifest.json is redirected to /login (application/json
// expected, HTML returned) and the browser reports
// "Manifest: Line: 1, column: 1, Syntax error."
const STATIC_ASSET_RE =
  /^\/[^/]+\.(?:ico|png|jpe?g|gif|svg|webp|avif|txt|xml|json|webmanifest|woff2?|ttf|otf|eot|map)$/i;

/**
 * A correlation id for the request, reused from the caller when present.
 * Bounded so a hostile client cannot smuggle an unbounded header value into
 * every downstream log line.
 */
function correlationId(request) {
  try {
    const incoming = request?.headers?.get?.("x-request-id");
    if (incoming && incoming.trim()) return incoming.trim().slice(0, 128);
  } catch {
    // A request shape without headers (middleware unit tests) — generate one.
  }
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    // fall through to a time-based id
  }
  return `req_${Date.now().toString(36)}`;
}

/** A `next()` pass-through carrying the correlation id to the route and back. */
function nextWithId(request, requestId) {
  try {
    const headers = new Headers(request?.headers);
    headers.set("x-request-id", requestId);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("x-request-id", requestId);
    return response;
  } catch {
    return NextResponse.next();
  }
}

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const requestId = correlationId(request);

  // Static assets never require a session.
  if (STATIC_ASSET_RE.test(pathname)) {
    return nextWithId(request, requestId);
  }

  // Allow public paths
  for (const publicPath of publicPaths) {
    if (pathname === publicPath || pathname.startsWith(publicPath + "/")) {
      return nextWithId(request, requestId);
    }
  }

  // Allow public API paths
  for (const publicPath of publicApiPaths) {
    if (pathname === publicPath || pathname.startsWith(publicPath + "/")) {
      return nextWithId(request, requestId);
    }
  }

  // Soft-auth paths: allow through even without cookie; client-side handles auth
  for (const softPath of softAuthPaths) {
    if (pathname === softPath || pathname.startsWith(softPath + "/")) {
      return nextWithId(request, requestId);
    }
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get("impactos_session");

  if (!sessionCookie) {
    // For API routes, return 401
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
      response.headers.set("x-request-id", requestId);
      return response;
    }

    // For page routes, redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return nextWithId(request, requestId);
}

export const config = {
  matcher: [
    // Match all routes except static files
    "/((?!_next/static|_next/image|favicon.ico|brand).*)",
  ],
};
