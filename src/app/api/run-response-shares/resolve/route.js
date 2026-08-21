import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hashToken, ensureRunResponseSharesTable } from "@/lib/token-hashing";
import { normalizeEmail } from "@/lib/email-utils";

export const dynamic = "force-dynamic";

/**
 * RUN RESPONSE SHARE — RESOLVE (read-only, login + email verified)
 *
 * GET /api/run-response-shares/resolve?token=...
 *
 * Security model (simple + strict):
 *   1. Token is hashed and used ONLY to locate the share row.
 *   2. Share must be 'active' and unexpired.
 *   3. The viewer MUST be logged in.
 *   4. The viewer's account email MUST equal the share email.
 *   5. Only then are the run's submissions returned (read-only).
 */

/** Turn a submission's data JSONB into a flat Q/A list for read-only display. */
function dataToAnswers(data) {
  if (!data || typeof data !== "object") return [];
  const answers = [];
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_")) continue; // internal keys (_scores etc.)
    if (value === null || value === undefined || value === "") continue;
    let display = value;
    if (typeof value === "object") {
      try { display = JSON.stringify(value); } catch { display = String(value); }
    }
    answers.push({ question_text: key, answer_text: String(display) });
  }
  return answers;
}

export async function GET(req) {
  try {
    await initDb();
    await ensureRunResponseSharesTable();
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ success: false, error: "Token is required." }, { status: 400 });
    }

    const shareRes = await db.execute({
      sql: "SELECT * FROM run_response_shares WHERE token_hash = ? LIMIT 1",
      args: [hashToken(token)],
    });
    if (shareRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Invalid or expired link." }, { status: 404 });
    }
    const share = shareRes.rows[0];

    if (share.status === "revoked") {
      return NextResponse.json({ success: false, error: "This share has been revoked." }, { status: 403 });
    }
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return NextResponse.json({ success: false, error: "This link has expired." }, { status: 403 });
    }
    if (share.status !== "active") {
      return NextResponse.json({ success: false, error: "This share is no longer active." }, { status: 403 });
    }

    // Login is MANDATORY — the token alone is never enough.
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Authentication required.", requiresLogin: true },
        { status: 401 },
      );
    }

    const viewerEmail = normalizeEmail(session.email);
    const shareEmail = normalizeEmail(share.email);
    if (!viewerEmail || viewerEmail !== shareEmail) {
      return NextResponse.json(
        {
          success: false,
          error: "Your account does not have access to this resource.",
          loggedInEmail: viewerEmail || null,
        },
        { status: 403 },
      );
    }

    const runRes = await db.execute({
      sql: `SELECT r.id, r.name, r.status, f.name AS form_name
            FROM platform_form_runs r LEFT JOIN platform_forms f ON f.id = r.form_id
            WHERE r.id = ?`,
      args: [share.run_id],
    });
    if (runRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Run not found." }, { status: 404 });
    }
    const run = runRes.rows[0];

    const subRes = await db.execute({
      sql: "SELECT id, submitter_name, status, submitted_at, data FROM platform_form_submissions WHERE run_id = ? ORDER BY submitted_at DESC NULLS LAST",
      args: [share.run_id],
    });

    // Best-effort view tracking + CRM timeline.
    try {
      await db.execute({ sql: "UPDATE run_response_shares SET last_viewed_at = NOW() WHERE id = ?", args: [share.id] });
      const contact = await db.execute({ sql: "SELECT cid FROM contacts WHERE LOWER(email) = LOWER(?) LIMIT 1", args: [share.email] });
      if (contact.rows[0]) {
        await db.execute({
          sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, metadata)
                VALUES (?, 'run_share_viewed', ?, 'platform_runs', ?, '{}'::jsonb)`,
          args: [contact.rows[0].cid, `Viewed responses for ${run.name}`, String(run.id)],
        });
      }
    } catch (_) {}

    const submissions = subRes.rows.map((s) => {
      let data = s.data;
      if (typeof data === "string") {
        try { data = JSON.parse(data); } catch { data = {}; }
      }
      return {
        id: s.id,
        submitter_name: s.submitter_name || null,
        status: s.status || null,
        submitted_at: s.submitted_at || null,
        answers: dataToAnswers(data),
      };
    });

    return NextResponse.json({
      success: true,
      run: { id: run.id, name: run.name, status: run.status, formName: run.form_name },
      submissions,
      viewerEmail,
      viewerName: session.name || viewerEmail,
      accessMethod: "session",
    });
  } catch (error) {
    console.error("Run response share resolve error:", error);
    return NextResponse.json({ success: false, error: "Server error." }, { status: 500 });
  }
}
