import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { hashToken, ensureFormResponseSharesTable } from "@/lib/token-hashing";
import { isValidEmail, normalizeEmail } from "@/lib/email-utils";
import { sendFormResponseShareEmail } from "@/lib/email";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * FORM RESPONSE SHARES — collection
 * POST /api/form-response-shares                  create a read-only share
 * POST /api/form-response-shares?action=revoke    revoke a share by id
 * GET  /api/form-response-shares?response_id=...  list shares (admin)
 */

const ADMIN_ROLES = ["super_admin", "admin", "program_manager", "staff", "teacher"];

export async function POST(req) {
  try {
    await initDb();
    await ensureFormResponseSharesTable();
    const authError = await requireAuth(ADMIN_ROLES);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const body = await req.json();
    const session = await getSession();

    // ─── REVOKE ────────────────────────────────────────────────
    if (action === "revoke") {
      const { id } = body;
      if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
      const result = await db.execute({
        sql: `UPDATE form_response_shares
              SET status = 'revoked', revoked_at = NOW(), revoked_by = ?
              WHERE id = ?
              RETURNING id`,
        args: [session?.cid || null, parseInt(id)],
      });
      if (result.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Share not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    // ─── CREATE ────────────────────────────────────────────────
    const { response_id, recipient_email, expires_in_days } = body;
    if (!response_id) return NextResponse.json({ success: false, error: "response_id is required" }, { status: 400 });

    const cleanEmail = normalizeEmail(recipient_email);
    if (!isValidEmail(cleanEmail)) {
      return NextResponse.json({ success: false, error: "Invalid email address" }, { status: 400 });
    }

    const ipLimited = enforceRateLimit(req, `response_share:ip:${getClientIp(req)}`, { limit: 30, windowMs: 10 * 60 * 1000 });
    if (ipLimited) return ipLimited;

    const sub = await db.execute({
      sql: "SELECT id, run_id, submitter_name, status, submitted_at, data FROM platform_form_submissions WHERE id = ?",
      args: [parseInt(response_id)],
    });
    if (sub.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Response not found" }, { status: 404 });
    }

    const token = uuidv4();
    const tokenHash = hashToken(token);
    const days = Math.max(1, Math.min(parseInt(expires_in_days) || 7, 90));
    const origin = new URL(req.url).origin;
    const shareUrl = `${origin}/share/${token}`;

    const insert = await db.execute({
      sql: `INSERT INTO form_response_shares
              (response_id, recipient_email, token_hash, status, expires_at, created_by)
            VALUES (?, ?, ?, 'active', NOW() + (INTERVAL '1 day' * ?), ?)
            RETURNING id`,
      args: [parseInt(response_id), cleanEmail, tokenHash, days, session?.cid || null],
    });

    const sendResult = await sendFormResponseShareEmail({
      to: cleanEmail,
      name: sub.rows[0].submitter_name || null,
      shareUrl,
    });

    return NextResponse.json({
      success: true,
      share: {
        id: insert.rows[0]?.id ?? insert.lastInsertRowid,
        recipient_email: cleanEmail,
        response_id: parseInt(response_id),
        status: "active",
        email_sent: !!sendResult?.success,
        share_url: shareUrl,
      },
    });
  } catch (error) {
    console.error("Form response share error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(ADMIN_ROLES);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const responseId = searchParams.get("response_id");

    let sql = "SELECT id, response_id, recipient_email, status, expires_at, created_by, created_at, last_viewed_at FROM form_response_shares WHERE 1=1";
    const args = [];
    if (responseId) {
      sql += " AND response_id = ?";
      args.push(parseInt(responseId));
    }
    sql += " ORDER BY created_at DESC";

    const res = await db.execute({ sql, args });
    return NextResponse.json({ success: true, shares: res.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
