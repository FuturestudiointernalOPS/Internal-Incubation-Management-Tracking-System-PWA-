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
  "/register-venture",
  "/register",
  "/join",
  "/verify",
  "/investor/wizard",
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
  "/api/families",
  "/api/verify",
  "/api/venture-invites",
  "/api/venture-member-invites",
  "/api/migrate",
  "/api/s",
  "/api/investor/register",
  "/api/investor/setup-password",
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

export function proxy(request) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  for (const publicPath of publicPaths) {
    if (pathname === publicPath || pathname.startsWith(publicPath + "/")) {
      return NextResponse.next();
    }
  }

  // Allow public API paths
  for (const publicPath of publicApiPaths) {
    if (pathname === publicPath || pathname.startsWith(publicPath + "/")) {
      return NextResponse.next();
    }
  }

  // Soft-auth paths: allow through even without cookie; client-side handles auth
  for (const softPath of softAuthPaths) {
    if (pathname === softPath || pathname.startsWith(softPath + "/")) {
      return NextResponse.next();
    }
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get("impactos_session");

  if (!sessionCookie) {
    // For API routes, return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    // For page routes, redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files
    "/((?!_next/static|_next/image|favicon.ico|brand).*)",
  ],
};
