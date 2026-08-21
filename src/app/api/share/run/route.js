import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createHmac, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";

// Secret used to sign per-email magic links. Set VIEW_SHARE_SECRET in .env.
const SHARE_SECRET =
  process.env.VIEW_SHARE_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "impactos-share-secret-fallback";

/**
 * Verify a per-email magic link signature.
 * Input: token:email:exp  →  HMAC-SHA256 hex
 */
function verifyMagicLink(token, email, exp, sig) {
  if (!token || !email || !exp || !sig) return false;
  if (Date.now() > parseInt(exp, 10)) return false; // expired
  const expected = createHmac("sha256", SHARE_SECRET)
    .update(`${token}:${email}:${exp}`)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
  } catch {
    return false;
  }
}

/**
 * Shared helper: fetch run + submissions for a given tokenRow.
 */
async function fetchRunData(tokenRow) {
  const runRes = await db.execute({
    sql: "SELECT r.id, r.name, r.status, f.name AS form_name FROM platform_form_runs r LEFT JOIN platform_forms f ON f.id = r.form_id WHERE r.id = ?",
    args: [tokenRow.run_id],
  });
  const run = runRes.rows[0];
  if (!run) return null;

  const subRes = await db.execute({
    sql: "SELECT s.id, s.respondent_name, s.respondent_email, s.submitted_at, s.score, s.is_reviewed, s.review_status FROM platform_form_submissions s WHERE s.run_id = ? ORDER BY s.submitted_at DESC",
    args: [tokenRow.run_id],
  });

  const submissions = [];
  for (const sub of subRes.rows) {
    let answers = [];
    try {
      const ansRes = await db.execute({
        sql: "SELECT a.question_text, a.answer_text, a.score, a.field_type FROM platform_form_answers a WHERE a.submission_id = ? ORDER BY a.id ASC",
        args: [sub.id],
      });
      answers = ansRes.rows;
    } catch (_) {}
    submissions.push({ ...sub, answers });
  }

  return { run, submissions };
}

export async function GET(req) {
  try {
    await initDb();
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json({ success: false, error: "Token is required." }, { status: 400 });
    }

    // ── 1. Resolve email from session OR magic link params ──────────────
    let email = null;
    let viewerName = null;
    let accessMethod = "session";

    // Try session first (logged-in users)
    const session = await getSession();
    if (session?.email) {
      email = session.email.toLowerCase().trim();
      viewerName = session.name || email;
    }

    // If no session, check for magic link params (?m=EMAIL&s=SIG&e=EXP)
    if (!email) {
      const m = url.searchParams.get("m"); // email
      const s = url.searchParams.get("s"); // signature
      const e = url.searchParams.get("e"); // expiry (ms timestamp)
      if (m && s && e) {
        const candidateEmail = decodeURIComponent(m).toLowerCase().trim();
        if (verifyMagicLink(token, candidateEmail, e, s)) {
          email = candidateEmail;
          viewerName = email;
          accessMethod = "magic_link";
        } else {
          return NextResponse.json(
            { success: false, error: "This magic link is invalid or has expired." },
            { status: 403 }
          );
        }
      }
    }

    // Neither session nor valid magic link → tell frontend to redirect to login
    if (!email) {
      return NextResponse.json(
        { success: false, error: "Authentication required.", requiresLogin: true },
        { status: 401 }
      );
    }

    // ── 2. Validate the run token ────────────────────────────────────────
    let tokenRow;
    try {
      const tokenRes = await db.execute({
        sql: "SELECT * FROM run_view_tokens WHERE token = ? AND is_active = TRUE LIMIT 1",
        args: [token],
      });
      tokenRow = tokenRes.rows[0];
    } catch (_) {
      return NextResponse.json({ success: false, error: "Invalid or expired link." }, { status: 404 });
    }

    if (!tokenRow) {
      return NextResponse.json({ success: false, error: "Invalid or expired link." }, { status: 404 });
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ success: false, error: "This link has expired." }, { status: 403 });
    }

    // ── 3. Check email allowlist ─────────────────────────────────────────
    let emailAllowed = false;
    try {
      const emailRes = await db.execute({
        sql: "SELECT 1 FROM run_view_token_emails WHERE token_id = ? AND LOWER(email) = ? LIMIT 1",
        args: [tokenRow.id, email],
      });
      emailAllowed = emailRes.rows.length > 0;
    } catch (_) {}

    if (!emailAllowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Your account does not have access to this resource.",
          loggedInEmail: email,
        },
        { status: 403 }
      );
    }

    // ── 4. Fetch and return run data ─────────────────────────────────────
    const runData = await fetchRunData(tokenRow);
    if (!runData) {
      return NextResponse.json({ success: false, error: "Run not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      run: {
        id: runData.run.id,
        name: runData.run.name,
        status: runData.run.status,
        formName: runData.run.form_name,
      },
      submissions: runData.submissions,
      viewerEmail: email,
      viewerName,
      accessMethod,
    });
  } catch (error) {
    console.error("Share view error:", error);
    return NextResponse.json({ success: false, error: "Server error." }, { status: 500 });
  }
}