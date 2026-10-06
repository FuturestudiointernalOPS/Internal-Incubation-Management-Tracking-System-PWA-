import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { after } from "next/server";
import { getClientIp } from "@/lib/rate-limit";
import { submitPublicResponse } from "@/services/platform/publicSubmit";
import {
  ensurePublicSubmitInvitationColumn,
  ensurePublicSubmitInvitationIndex,
  ensurePublicSubmitRateTable,
} from "@/models/publicFormRuns";

/**
 * POST /api/s/public-submit
 * Public endpoint — accepts form submissions without auth.
 *
 * Thin controller: the decisions (run resolution, deadline, consent, rate
 * limit, identity, duplicates, submission limit, checkout capture, automation)
 * live in `services/platform/publicSubmit`. This file keeps the HTTP boundary:
 * the schema self-heal, the payload-size guard, the capture cookie and the
 * response envelope.
 *
 * Security:
 * - Only active runs accepted
 * - Deadline enforced
 * - Max 100KB payload
 * - Duplicate detection by email
 * - IP-based rate limiting: max 5 submissions per IP per run per hour
 */

// platform_form_submissions.invitation_id self-heal stays: the column is
// written by the submission inserts, so this route keeps it present —
// process, idempotent, never destructive.
let submitSchemaPromise = null;
async function ensurePublicSubmitSchema() {
  if (!submitSchemaPromise) {
    submitSchemaPromise = (async () => {
      try {
        await ensurePublicSubmitInvitationColumn();
        await ensurePublicSubmitInvitationIndex();
      } catch (error) {
        console.warn("[Public Submit] schema ensure failed:", error.message);
      }
      try {
        await ensurePublicSubmitRateTable();
      } catch (_) {}
      return true;
    })();
  }
  return submitSchemaPromise;
}

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

    const result = await submitPublicResponse({
      data,
      slug,
      consent,
      language,
      ip,
      browserToken: readBrowserToken(req),
      after,
    });

    return withBrowserCookie(
      NextResponse.json(result.body, { status: result.status }),
      result.browserToken,
    );
  } catch (error) {
    console.error("[Public Submit] Error:", error.message, error.stack);
    console.error("[Public Submit] Request body snippet:", JSON.stringify(body || {}).substring(0, 200));
    return NextResponse.json({ success: false, error: "An error occurred — our team has been notified" }, { status: 500 });
  }
}
