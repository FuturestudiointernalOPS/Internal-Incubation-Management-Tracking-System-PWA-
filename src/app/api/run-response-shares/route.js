import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import { hashToken, ensureRunResponseSharesTable, ensureTokenHashColumns } from "@/lib/token-hashing";
import { isValidEmail, normalizeEmail, parseEmailList } from "@/lib/email-utils";
import { sendRunResponseShareEmail } from "@/lib/email";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * RUN RESPONSE SHARES — collection
 * POST /api/run-response-shares                  create shares for one or more emails
 * POST /api/run-response-shares?action=revoke    revoke a share by id
 * GET  /api/run-response-shares?run_id=...       list shares (admin)
 */

const ADMIN_ROLES = ["super_admin", "admin", "program_manager", "staff", "teacher"];

/** Record a CRM timeline event for the contact (best-effort). */
async function recordTimeline(contactCid, eventType, description, contextId, actorId) {
  try {
    await db.execute({
      sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
            VALUES (?, ?, ?, 'platform_runs', ?, ?, '{}'::jsonb)`,
      args: [contactCid, eventType, description, contextId ? String(contextId) : null, actorId || null],
    });
  } catch (_) {}
}

export async function POST(req) {
  try {
    await initDb();
    await ensureRunResponseSharesTable();
    await ensureTokenHashColumns();
    const authError = await requireAuth(ADMIN_ROLES);
    if (authError) return authError;

    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const body = await req.json();

    // ─── REVOKE ────────────────────────────────────────────────
    if (action === "revoke") {
      const { id } = body;
      if (!id) return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
      const result = await db.execute({
        sql: `UPDATE run_response_shares SET status = 'revoked', revoked_at = NOW(), revoked_by = ?
              WHERE id = ? RETURNING id, email, run_id`,
        args: [session?.cid || null, parseInt(id)],
      });
      if (result.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Share not found" }, { status: 404 });
      }
      const row = result.rows[0];
      if (row.email) {
        const contact = await db.execute({ sql: "SELECT cid FROM contacts WHERE LOWER(email) = LOWER(?) LIMIT 1", args: [row.email] });
        if (contact.rows[0]) {
          await recordTimeline(contact.rows[0].cid, "run_share_revoked", "View access revoked for run responses", row.run_id, session?.cid);
        }
      }
      return NextResponse.json({ success: true });
    }

    // ─── CREATE ────────────────────────────────────────────────
    const { run_id, email, emails, expires_in_days, customMessage } = body;
    const rawEmails = Array.isArray(emails) && emails.length
      ? emails
      : (email ? [email] : []);
    const cleanEmails = parseEmailList(rawEmails.join("\n"));

    if (!run_id) return NextResponse.json({ success: false, error: "run_id is required" }, { status: 400 });
    if (cleanEmails.length === 0) {
      return NextResponse.json({ success: false, error: "At least one valid email is required" }, { status: 400 });
    }

    const ipLimited = enforceRateLimit(req, `run_share:ip:${getClientIp(req)}`, { limit: 50, windowMs: 10 * 60 * 1000 });
    if (ipLimited) return ipLimited;

    const runRes = await db.execute({
      sql: `SELECT r.id, r.name, f.name AS form_name
            FROM platform_form_runs r LEFT JOIN platform_forms f ON f.id = r.form_id WHERE r.id = ?`,
      args: [parseInt(run_id)],
    });
    if (runRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });
    }
    const run = runRes.rows[0];

    const days = Math.max(1, Math.min(parseInt(expires_in_days) || 7, 90));
    const origin = new URL(req.url).origin;
    const results = [];

    for (const cleanEmail of cleanEmails) {
      try {
        // Resolve or create the contact (never duplicate).
        let contact = await db.execute({
          sql: "SELECT cid, name, password FROM contacts WHERE LOWER(email) = LOWER(?) AND deleted = 0 LIMIT 1",
          args: [cleanEmail],
        });
        let contactCid;
        let activationUrl = null;
        let contactName = "";

        if (contact.rows.length > 0) {
          contactCid = contact.rows[0].cid;
          contactName = contact.rows[0].name || "";
          const hasPassword = !!String(contact.rows[0].password || "").trim();
          // Account exists but was never activated → issue an activation link too.
          if (!hasPassword) {
            await db.execute({ sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ?", args: [contactCid] });
            const token = uuidv4();
            await db.execute({
              sql: "INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at, token_type) VALUES (?, ?, ?, NOW() + INTERVAL '48 hours', 'run_share')",
              args: [token, hashToken(token), contactCid],
            });
            activationUrl = `${origin}/activate?token=${token}`;
          }
        } else {
          contactCid = "USR_" + uuidv4().toUpperCase().replace(/-/g, "").substring(0, 12);
          await db.execute({
            sql: "INSERT INTO contacts (cid, name, email, role, status) VALUES (?, ?, ?, 'participant', 'pending')",
            args: [contactCid, "", cleanEmail],
          });
          await db.execute({ sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ?", args: [contactCid] });
          const token = uuidv4();
          await db.execute({
            sql: "INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at, token_type) VALUES (?, ?, ?, NOW() + INTERVAL '48 hours', 'run_share')",
            args: [token, hashToken(token), contactCid],
          });
          activationUrl = `${origin}/activate?token=${token}`;
        }

        // Create the share (token stored hashed only).
        const shareToken = uuidv4();
        await db.execute({
          sql: `INSERT INTO run_response_shares (run_id, email, token_hash, status, expires_at, created_by)
                VALUES (?, ?, ?, 'active', NOW() + (INTERVAL '1 day' * ?), ?)`,
          args: [parseInt(run_id), cleanEmail, hashToken(shareToken), days, session?.cid || null],
        });
        const shareUrl = `${origin}/share/run/${shareToken}`;

        // One combined email: activation (if new/inactive) + view link.
        const sendResult = await sendRunResponseShareEmail({
          to: cleanEmail,
          name: contactName,
          shareUrl,
          activationUrl,
          runName: run.name,
          customMessage: customMessage || null,
        });

        await recordTimeline(contactCid, "run_share_created", `Invited to view responses for ${run.name}`, run.id, session?.cid);
        if (activationUrl) {
          await recordTimeline(contactCid, "invitation_sent", "Activation email sent (view-responses access)", run.id, session?.cid);
        }

        results.push({ email: cleanEmail, success: true, share_url: shareUrl, activation_sent: !!activationUrl, email_sent: !!sendResult?.success });
      } catch (e) {
        console.error("[run-response-shares] create error for", cleanEmail, e);
        results.push({ email: cleanEmail, success: false, error: e?.message || "Failed to create share" });
      }
    }

    return NextResponse.json({ success: true, run_id: parseInt(run_id), run_name: run.name, results });
  } catch (error) {
    console.error("Run response share error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    await initDb();
    await ensureRunResponseSharesTable();
    const authError = await requireAuth(ADMIN_ROLES);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("run_id");

    let sql = "SELECT id, run_id, email, status, expires_at, created_by, created_at, last_viewed_at FROM run_response_shares WHERE 1=1";
    const args = [];
    if (runId) {
      sql += " AND run_id = ?";
      args.push(parseInt(runId));
    }
    sql += " ORDER BY created_at DESC";

    const res = await db.execute({ sql, args });
    return NextResponse.json({ success: true, shares: res.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
