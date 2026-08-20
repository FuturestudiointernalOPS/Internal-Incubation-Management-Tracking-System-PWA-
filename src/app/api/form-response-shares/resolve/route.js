import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hashToken, ensureFormResponseSharesTable } from "@/lib/token-hashing";
import { normalizeEmail } from "@/lib/email-utils";

export const dynamic = "force-dynamic";

/**
 * FORM RESPONSE SHARE — RESOLVE (read-only, email-verified)
 *
 * GET /api/form-response-shares/resolve?token=...
 *
 * Security model:
 *   1. The token is hashed and used ONLY to locate the share row.
 *   2. The share must be 'active' and unexpired.
 *   3. The viewer MUST be authenticated.
 *   4. The viewer's verified account email MUST match recipient_email.
 *   5. Only then is the single response returned (read-only, no mutation).
 *
 * Returns:
 *   { authRequired: true }          → viewer must log in first (frontend redirects)
 *   { forbidden: true, reason }     → logged in but not the intended recipient
 *   { success: true, response }     → authorized read-only response
 */

function parseData(value) {
  if (value == null) return {};
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return { _raw: value }; }
  }
  return {};
}

export async function GET(req) {
  try {
    await initDb();
    await ensureFormResponseSharesTable();
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ success: false, error: "Token is required" }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const shareRes = await db.execute({
      sql: "SELECT * FROM form_response_shares WHERE token_hash = ? LIMIT 1",
      args: [tokenHash],
    });

    if (shareRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Share not found" }, { status: 404 });
    }

    const share = shareRes.rows[0];

    if (share.status === "revoked") {
      return NextResponse.json({ success: false, forbidden: true, reason: "revoked" }, { status: 403 });
    }
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return NextResponse.json({ success: false, forbidden: true, reason: "expired" }, { status: 403 });
    }
    if (share.status !== "active") {
      return NextResponse.json({ success: false, forbidden: true, reason: "unavailable" }, { status: 403 });
    }

    const session = await getSession();
    if (!session) {
      // Must authenticate. The frontend redirects to login and returns here.
      return NextResponse.json({ success: false, authRequired: true }, { status: 401 });
    }

    // The token alone is NOT sufficient — the authenticated email must match.
    const viewerEmail = normalizeEmail(session.email);
    const recipientEmail = normalizeEmail(share.recipient_email);
    if (!viewerEmail || viewerEmail !== recipientEmail) {
      return NextResponse.json({ success: false, forbidden: true, reason: "email_mismatch" }, { status: 403 });
    }

    const sub = await db.execute({
      sql: "SELECT id, run_id, submitter_name, status, submitted_at, data FROM platform_form_submissions WHERE id = ?",
      args: [share.response_id],
    });

    if (sub.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Response not found" }, { status: 404 });
    }

    // Best-effort view tracking (never blocks access on failure).
    try {
      await db.execute({
        sql: "UPDATE form_response_shares SET last_viewed_at = NOW() WHERE id = ?",
        args: [share.id],
      });
    } catch (_) {}

    const row = sub.rows[0];
    return NextResponse.json({
      success: true,
      response: {
        id: row.id,
        run_id: row.run_id,
        submitter_name: row.submitter_name || null,
        status: row.status || null,
        submitted_at: row.submitted_at || null,
        data: parseData(row.data),
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
