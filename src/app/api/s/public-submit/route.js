import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getClientIp } from "@/lib/rate-limit";
import { ensurePublicSubmitSchema, submitPublicForm } from "@/services/platform/publicSubmit";

// The cookie that proves WHICH browser captured a registration. It carries a
// one-way token (only its hash is stored server-side) and is httpOnly, so no
// script and no stranger who merely knows the email can present it. It is what
// lets an unpaid payment be RESUMED by its own browser while everyone else is
// answered neutrally.
const CHECKOUT_COOKIE = "impactos_checkout";
const CHECKOUT_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function readBrowserToken(req) {
  const fromCookies = req?.cookies?.get?.(CHECKOUT_COOKIE)?.value;
  if (fromCookies) return fromCookies;
  // Fallback for a plain Request (and for any runtime where `cookies` is absent).
  const header = req?.headers?.get?.("cookie") || "";
  const match = new RegExp(`(?:^|;\\s*)${CHECKOUT_COOKIE}=([^;]+)`).exec(header);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Attach the capture cookie — but only when a fresh registration minted one. */
function withBrowserCookie(response, browserToken) {
  if (!browserToken) return response;
  response.cookies.set({
    name: CHECKOUT_COOKIE,
    value: browserToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CHECKOUT_COOKIE_MAX_AGE,
  });
  return response;
}

/**
 * POST /api/s/public-submit
 * Public endpoint — accepts form submissions without auth.
 *
 * Security:
 * - Only active runs accepted
 * - Deadline enforced
 * - Max 100KB payload
 * - Duplicate detection by email
 * - IP-based rate limiting: max 5 submissions per IP per run per hour
 */
export async function POST(req) {
  let body = null;
  try {
    await initDb();
    await ensurePublicSubmitSchema();

    // Get client IP (trusted hop — see getClientIp; the per-run submission limit
    // below is only as good as the key it is counted under, RATE-2).
    const ip = getClientIp(req);

    // Rate limit: check content-length
    const contentLength = parseInt(req.headers.get("content-length") || "0");
    if (contentLength > 100000) {
      return NextResponse.json({ success: false, error: "Payload too large" }, { status: 413 });
    }

    body = await req.json();
    const { data, slug, consent, language } = body;

    const result = await submitPublicForm({ data, slug, consent, language, ip, browserToken: readBrowserToken(req) });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.statusCode || 500 });
    }
    return withBrowserCookie(
      NextResponse.json({ success: true, ...result.payload }),
      result.browserToken,
    );
  } catch (error) {
    console.error("[Public Submit] Error:", error.message, error.stack);
    console.error("[Public Submit] Request body snippet:", JSON.stringify(body || {}).substring(0, 200));
    return NextResponse.json({ success: false, error: "An error occurred — our team has been notified" }, { status: 500 });
  }
}
