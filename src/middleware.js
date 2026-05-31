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
 *   - /register-participant
 *   - /register-staff
 *   - /api/contacts (POST - registration)
 *   - /_next/*
 *   - /brand/*
 *   - /favicon.ico
 */

const publicPaths = [
  "/login",
  "/forgot-password",
  "/setup-password",
  "/invite",
  "/register-participant",
  "/register-staff",
  "/_next",
  "/brand",
  "/favicon.ico",
];

const publicApiPaths = [
  "/api/auth/session-login",
  "/api/auth/session",
  "/api/auth/forgot-password",
  "/api/auth/setup-password",
  "/api/contacts",
  "/api/invites",
];

export function middleware(request) {
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

  // Check for session cookie
  const sessionCookie = request.cookies.get("impactos_session");

  if (!sessionCookie) {
    // For API routes, return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
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
