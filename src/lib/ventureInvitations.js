/**
 * VENTURE RUN INVITATIONS (Phase 3)
 *
 * Tracked invitations into the Venture Run:
 *   staff → invitation row (token) → email with run URL → recipient submits
 *   → submission linked via invitation_id → status converted.
 *
 * Invite ≠ create: an invitation NEVER creates a Venture. Only the approval
 * pipeline does.
 */

import db, { initDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { hashToken } from "@/lib/token-hashing";

export async function resolveVentureRun() {
  await initDb();
  const cfg = await db.execute({
    sql: "SELECT value FROM system_settings WHERE key = 'venture_run_id'",
    args: [],
  });
  const runId = cfg.rows[0]?.value;
  if (runId) {
    const r = await db.execute({
      sql: "SELECT * FROM platform_form_runs WHERE id = ?",
      args: [runId],
    });
    if (r.rows.length > 0 && r.rows[0].public_slug) return r.rows[0];
  }
  const fb = await db.execute({
    sql: `SELECT r.* FROM platform_form_runs r
          JOIN platform_forms f ON f.id = r.form_id
          WHERE r.status = 'active' AND r.public_slug IS NOT NULL
            AND f.settings->>'venture_application' = 'true'
          ORDER BY r.created_at DESC LIMIT 1`,
    args: [],
  });
  return fb.rows[0] || null;
}

export function ventureRunUrl(run) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${appUrl}/s/${run.public_slug}`;
}

export async function createVentureInvitation({
  runId,
  contactCid = null,
  email,
  sourceType = "external",
  programId = null,
  cohortId = null,
  teamId = null,
  invitedByCid = null,
  expiresInHours = 168,
}) {
  await initDb();
  const emailNorm = String(email || "").trim().toLowerCase();
  if (!emailNorm || !emailNorm.includes("@")) {
    throw new Error("A valid recipient email is required.");
  }
  const token = uuidv4().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString();
  const res = await db.execute({
    sql: `INSERT INTO platform_form_run_invitations
            (run_id, contact_cid, email, source_type, program_id, cohort_id, team_id, invited_by_cid, token, token_hash, expires_at, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', NOW())
          RETURNING id`,
    args: [
      runId || null,
      contactCid || null,
      emailNorm,
      sourceType,
      programId || null,
      cohortId || null,
      teamId || null,
      invitedByCid || null,
      token,
      hashToken(token),
      expiresAt,
    ],
  });
  return { id: res.rows[0]?.id, token, email: emailNorm, expires_at: expiresAt };
}

export async function getVentureInvitationByToken(token) {
  await initDb();
  if (!token) return { error: "invalid" };
  const res = await db.execute({
    sql: "SELECT * FROM platform_form_run_invitations WHERE token_hash = ? OR token = ?",
    args: [hashToken(token), token],
  });
  const invitation = res.rows?.[0];
  if (!invitation) return { error: "invalid" };

  // Lazily backfill the hash for legacy rows stored before hashing was added.
  if (!invitation.token_hash) {
    try {
      await db.execute({
        sql: "UPDATE platform_form_run_invitations SET token_hash = ? WHERE id = ?",
        args: [hashToken(token), invitation.id],
      });
    } catch (_) {}
  }

  if (invitation.status === "revoked") return { error: "expired", invitation };
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return { error: "expired", invitation };
  }
  return { invitation };
}

export async function getVentureInvitationById(id) {
  await initDb();
  if (!id) return null;
  const res = await db.execute({
    sql: "SELECT * FROM platform_form_run_invitations WHERE id = ?",
    args: [id],
  });
  return res.rows[0] || null;
}

export async function markVentureInvitationStatus(id, status) {
  await initDb();
  if (!id || !status) return;
  await db.execute({
    sql: "UPDATE platform_form_run_invitations SET status = ?, used_at = COALESCE(used_at, NOW()) WHERE id = ?",
    args: [status, id],
  });
}

export default {
  resolveVentureRun,
  ventureRunUrl,
  createVentureInvitation,
  getVentureInvitationByToken,
  getVentureInvitationById,
  markVentureInvitationStatus,
};
