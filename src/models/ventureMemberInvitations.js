/**
 * VENTURE MEMBER INVITATIONS
 *
 * A founder adds a member to their Venture by EMAIL, not by picking a person
 * out of a directory: the add creates a PENDING invitation and emails a link.
 * The person only becomes a member once they open the link and accept.
 *
 * Invite ≠ member: an invitation row never grants access. Acceptance is the
 * only writer of a `venture_members` row (see `completeVentureMemberInvitation`).
 * This is why nothing about Venture access checks changes here — a pending
 * invitation is invisible to every membership query.
 *
 * The invitee may come from anywhere: an existing program participant, an
 * existing internal contact, or someone the platform has never seen. Identity
 * is resolved (never guessed) at acceptance:
 *   matched  → the existing contact is used
 *   conflict → refused; CRM reconciliation is the authority
 *   new      → a minimal contact is created
 */

import db from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { hashToken } from "@/lib/token-hashing";
import {
  normalizeEmail,
  resolvePersonIdentity,
  resolveOrCreateContactIdentity,
  syncVentureRoleHistory,
} from "@/models/contactIdentity";

const DEFAULT_EXPIRY_HOURS = 168; // 7 days

/** Swallow a failure so a doomed optional statement cannot fail the request. */
async function safe(sql, args = []) {
  try {
    return await db.execute({ sql, args });
  } catch (_) {
    return { rows: [] };
  }
}

let schemaPromise = null;

/**
 * The invitation table, created on first use. Every statement is
 * `IF NOT EXISTS`, so it is a no-op on a database that already has it, and the
 * engine memoises each one for the rest of the process.
 */
export function ensureVentureMemberInvitationSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await safe(
        `CREATE TABLE IF NOT EXISTS venture_member_invitations (
           id SERIAL PRIMARY KEY,
           venture_id TEXT NOT NULL,
           email TEXT NOT NULL,
           name TEXT,
           member_type TEXT NOT NULL DEFAULT 'team_member',
           role TEXT,
           contact_id TEXT,
           invited_by TEXT,
           token TEXT,
           token_hash TEXT,
           status TEXT NOT NULL DEFAULT 'pending',
           expires_at TIMESTAMPTZ,
           accepted_at TIMESTAMPTZ,
           responded_at TIMESTAMPTZ,
           email_status TEXT,
           email_error TEXT,
           email_sent_at TIMESTAMPTZ,
           created_at TIMESTAMPTZ DEFAULT NOW()
         )`,
      );
      // Existing installs predate the delivery-tracking columns.
      await safe("ALTER TABLE venture_member_invitations ADD COLUMN IF NOT EXISTS email_status TEXT");
      await safe("ALTER TABLE venture_member_invitations ADD COLUMN IF NOT EXISTS email_error TEXT");
      await safe("ALTER TABLE venture_member_invitations ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ");
      await safe(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_vmi_token_hash ON venture_member_invitations(token_hash) WHERE token_hash IS NOT NULL",
      );
      await safe(
        "CREATE INDEX IF NOT EXISTS idx_vmi_venture_status ON venture_member_invitations(venture_id, status)",
      );
      await safe(
        "CREATE INDEX IF NOT EXISTS idx_vmi_email ON venture_member_invitations(LOWER(email))",
      );
      return true;
    })().catch((error) => {
      console.warn("[VentureMemberInvitations] schema ensure failed:", error.message);
      schemaPromise = null; // allow retry on the next call
      return false;
    });
  }
  return schemaPromise;
}

/**
 * A founder relationship grants the mapped profile's capabilities. Best-effort:
 * a failure here must never fail the acceptance itself.
 */
async function applyVentureContextGrants(cid) {
  if (!cid) return;
  try {
    const { syncContextGrantsForUser } = await import(
      "@/models/authorization/contextGrants"
    );
    await syncContextGrantsForUser(cid);
  } catch (_) {}
}

function defaultRoleFor(memberType, role) {
  if (role) return role;
  return memberType === "founder" ? "founder" : "member";
}

/** A person already recorded under this email, if any (display + linking only). */
async function findContactByEmail(email) {
  const result = await safe(
    "SELECT cid, name, (password IS NOT NULL AND password <> '') AS has_account FROM contacts WHERE LOWER(email) = ? AND deleted = 0 LIMIT 1",
    [email],
  );
  return result.rows?.[0] || null;
}

function isExpired(row) {
  return !!row?.expires_at && new Date(row.expires_at) < new Date();
}

/**
 * Create (or re-send) a pending invitation for `email`.
 *
 * Re-sending reuses the existing pending row and mints a NEW token, so an
 * earlier link stops working — exactly the intent of "resend".
 */
export async function createVentureMemberInvitation({
  ventureId,
  email,
  name = null,
  memberType = "team_member",
  role = null,
  invitedByCid = null,
  expiresInHours = DEFAULT_EXPIRY_HOURS,
}) {
  await ensureVentureMemberInvitationSchema();

  const emailNorm = normalizeEmail(email);
  if (!emailNorm || !emailNorm.includes("@")) {
    throw new Error("A valid recipient email is required.");
  }
  if (!["founder", "team_member"].includes(memberType)) {
    throw new Error("member_type must be 'founder' or 'team_member'.");
  }

  const contact = await findContactByEmail(emailNorm);
  const contactId = contact?.cid || null;
  const displayName = name || contact?.name || null;
  const effectiveRole = defaultRoleFor(memberType, role);
  const token = uuidv4().replace(/-/g, "");
  const expiresAt = new Date(
    Date.now() + expiresInHours * 3600 * 1000,
  ).toISOString();

  const existing = await safe(
    "SELECT id FROM venture_member_invitations WHERE venture_id = ? AND LOWER(email) = ? AND status = 'pending' ORDER BY id DESC LIMIT 1",
    [ventureId, emailNorm],
  );

  if (existing.rows?.length) {
    const id = existing.rows[0].id;
    await db.execute({
      sql: `UPDATE venture_member_invitations
            SET email = ?, name = ?, member_type = ?, role = ?, contact_id = ?,
                invited_by = ?, token = ?, token_hash = ?, expires_at = ?,
                email_status = NULL, email_error = NULL, email_sent_at = NULL,
                created_at = NOW(), responded_at = NULL
            WHERE id = ?`,
      args: [
        emailNorm,
        displayName,
        memberType,
        effectiveRole,
        contactId,
        invitedByCid || null,
        token,
        hashToken(token),
        expiresAt,
        id,
      ],
    });
    return { id, token, email: emailNorm, expires_at: expiresAt, resent: true };
  }

  const inserted = await db.execute({
    sql: `INSERT INTO venture_member_invitations
            (venture_id, email, name, member_type, role, contact_id, invited_by, token, token_hash, status, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NOW())
          RETURNING id`,
    args: [
      ventureId,
      emailNorm,
      displayName,
      memberType,
      effectiveRole,
      contactId,
      invitedByCid || null,
      token,
      hashToken(token),
      expiresAt,
    ],
  });

  return {
    id: inserted.rows?.[0]?.id || null,
    token,
    email: emailNorm,
    expires_at: expiresAt,
    resent: false,
  };
}

/** Pending invitations for a Venture, newest first, with a display name. */
export async function listVentureMemberInvitations(ventureId) {
  await ensureVentureMemberInvitationSchema();
  const result = await safe(
    `SELECT i.id, i.venture_id, i.email, i.name, i.member_type, i.role,
            i.status, i.expires_at, i.created_at,
            i.email_status, i.email_error,
            COALESCE(i.name, c.name) AS display_name
     FROM venture_member_invitations i
     LEFT JOIN contacts c ON LOWER(c.email) = LOWER(i.email) AND c.deleted = 0
     WHERE i.venture_id = ? AND i.status = 'pending'
     ORDER BY i.created_at DESC, i.id DESC`,
    [ventureId],
  );
  return (result.rows || []).map((row) => ({ ...row, is_expired: isExpired(row) }));
}

/**
 * Read an invitation by its link token. Returns `{ error }` for the three
 * dead-end cases the acceptance screen must tell apart.
 */
export async function getVentureMemberInvitationByToken(token) {
  await ensureVentureMemberInvitationSchema();
  if (!token) return { error: "invalid" };

  const result = await safe(
    "SELECT * FROM venture_member_invitations WHERE (token_hash = ? OR token = ?) LIMIT 1",
    [hashToken(token), token],
  );
  const invitation = result.rows?.[0];
  if (!invitation) return { error: "invalid" };
  if (invitation.status === "accepted") return { error: "already", invitation };
  if (invitation.status !== "pending") return { error: "revoked", invitation };
  if (isExpired(invitation)) return { error: "expired", invitation };
  return { invitation };
}

/** What the acceptance screen needs: the Venture, the intended role, account state. */
export async function describeVentureMemberInvitation(token) {
  const result = await getVentureMemberInvitationByToken(token);
  if (result.error) return { error: result.error };

  const invitation = result.invitation;
  const venture = await safe(
    "SELECT COALESCE(NULLIF(name, ''), company_name) AS venture_name, company_name FROM ventures WHERE venture_id = ? LIMIT 1",
    [invitation.venture_id],
  );
  const contact = await findContactByEmail(invitation.email);

  return {
    invitation: {
      venture_name:
        venture.rows?.[0]?.venture_name ||
        venture.rows?.[0]?.company_name ||
        "the Venture",
      email: invitation.email,
      name: invitation.name || contact?.name || "",
      member_type: invitation.member_type,
      role: invitation.role,
      has_account: !!contact?.has_account,
    },
  };
}

/**
 * Accept an invitation: the ONLY place a venture membership is created from an
 * invitation. Resolves (or creates) the person, optionally sets a password so an
 * outside guest can sign in, writes the membership, records history and applies
 * the founder grants.
 *
 * Returns `{ ok: true, ... }` or `{ ok: false, error }`.
 */
export async function completeVentureMemberInvitation({
  token,
  name = null,
  password = null,
  actorCid = null,
} = {}) {
  await ensureVentureMemberInvitationSchema();

  const result = await getVentureMemberInvitationByToken(token);
  if (result.error) return { ok: false, error: result.error };
  const invitation = result.invitation;

  if (password && String(password).length < 6) {
    return { ok: false, error: "weak_password" };
  }

  // ── Identity: resolve, never guess ────────────────────────────────────────
  let contactCid = invitation.contact_id || null;
  const identity = await resolvePersonIdentity({ email: invitation.email, phone: null });
  if (identity.status === "matched") {
    contactCid = identity.contact_cid;
  } else if (identity.status === "conflict") {
    return { ok: false, error: "identity_conflict" };
  } else if (!contactCid) {
    contactCid = await resolveOrCreateContactIdentity({
      email: invitation.email,
      name: name || invitation.name,
      role: invitation.member_type === "founder" ? "founder" : "member",
    });
  }
  if (!contactCid) return { ok: false, error: "identity_unresolved" };

  // ── Optional account creation, so a guest from outside can sign in ────────
  if (password) {
    const hashed = await bcrypt.hash(String(password), 12);
    await safe(
      `UPDATE contacts SET password = ?, status = 'active',
              name = COALESCE(NULLIF(?, ''), name)
       WHERE cid = ?`,
      [hashed, name || "", contactCid],
    );
  }

  // ── Membership: reopen a former row, otherwise insert a new one ────────────
  const existing = await safe(
    `SELECT id, removed_at FROM venture_members
     WHERE venture_id = ? AND (contact_id = ? OR user_cid = ?)
     ORDER BY (removed_at IS NULL) DESC, id DESC LIMIT 1`,
    [invitation.venture_id, contactCid, contactCid],
  );
  const role = defaultRoleFor(invitation.member_type, invitation.role);

  if (existing.rows?.length && !existing.rows[0].removed_at) {
    // Already an active member — accepting again must not duplicate the row.
    await markAccepted(invitation.id, contactCid);
    return { ok: true, already_member: true, venture_id: invitation.venture_id, contact_cid: contactCid };
  }

  if (existing.rows?.length) {
    await db.execute({
      sql: `UPDATE venture_members
            SET removed_at = NULL, member_type = ?, role = ?, permissions = 'edit',
                joined_at = NOW(), invited_by = ?
            WHERE id = ?`,
      args: [invitation.member_type, role, invitation.invited_by || null, existing.rows[0].id],
    });
  } else {
    await db.execute({
      sql: `INSERT INTO venture_members
              (venture_id, contact_id, user_cid, member_type, role, permissions, invited_by, joined_at)
            VALUES (?, ?, ?, ?, ?, 'edit', ?, NOW())`,
      args: [
        invitation.venture_id,
        contactCid,
        contactCid,
        invitation.member_type,
        role,
        invitation.invited_by || null,
      ],
    });
  }

  // Append-only membership history (account/contact untouched).
  await syncVentureRoleHistory({
    contactCid,
    ventureId: invitation.venture_id,
    role,
    active: true,
    actorCid: actorCid || invitation.invited_by || null,
    notes: "member joined via invitation",
  }).catch(() => null);

  // A founder relationship grants the mapped profile's capabilities.
  if (invitation.member_type === "founder") await applyVentureContextGrants(contactCid);

  await markAccepted(invitation.id, contactCid);

  return {
    ok: true,
    venture_id: invitation.venture_id,
    contact_cid: contactCid,
    member_type: invitation.member_type,
  };
}

async function markAccepted(invitationId, contactCid) {
  await safe(
    `UPDATE venture_member_invitations
     SET status = 'accepted', accepted_at = NOW(), responded_at = NOW(),
         contact_id = COALESCE(contact_id, ?), token = NULL
     WHERE id = ?`,
    [contactCid || null, invitationId],
  );
}

/**
 * Record the outcome of the invitation email attempt on the invitation itself.
 * The pending list reads this back, so a failed delivery is visible after the
 * fact — not only in the moment of sending. Best-effort: never throws.
 */
export async function recordVentureMemberInvitationDelivery({ id, sent, error = null } = {}) {
  if (!id) return { ok: false };
  await ensureVentureMemberInvitationSchema();
  await safe(
    `UPDATE venture_member_invitations
     SET email_status = ?, email_error = ?, email_sent_at = ?
     WHERE id = ?`,
    [
      sent ? "sent" : "failed",
      sent ? null : String(error || "").substring(0, 500) || null,
      sent ? new Date().toISOString() : null,
      id,
    ],
  );
  return { ok: true };
}

/** Withdraw a pending invitation. Only a still-pending row can be revoked. */
export async function revokeVentureMemberInvitation({ id, ventureId }) {
  await ensureVentureMemberInvitationSchema();
  const result = await db.execute({
    sql: `UPDATE venture_member_invitations
          SET status = 'revoked', responded_at = NOW()
          WHERE id = ? AND venture_id = ? AND status = 'pending'`,
    args: [id, ventureId],
  });
  return { ok: (result.rowsAffected || 0) > 0 };
}

export default {
  ensureVentureMemberInvitationSchema,
  createVentureMemberInvitation,
  recordVentureMemberInvitationDelivery,
  listVentureMemberInvitations,
  getVentureMemberInvitationByToken,
  describeVentureMemberInvitation,
  completeVentureMemberInvitation,
  revokeVentureMemberInvitation,
};
