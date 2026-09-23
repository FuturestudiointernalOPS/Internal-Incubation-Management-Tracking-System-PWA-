/**
 * Venture coach identity & invitation (Vinance 3 — Manager & Coach model).
 *
 * A coach on a Venture is a PLATFORM USER (a contact): Future Studio staff
 * (existing staff contact / Venture assignment) or an invited external coach
 * (created through inviteCoachByEmail with the narrow 'facilitator' role —
 * never 'staff'; Venture access comes from the assignment row, not a broad
 * global role).
 *
 * Sessions keep their legacy `coach_id`/`coach_name` (catalog) for display,
 * but gain a soft-ref `coach_contact_id` so the platform can deliver
 * calendar / notifications / email to the actual person. Resolution:
 *   1. explicit coach_contact_id → the contact itself;
 *   2. legacy catalog coach_id → match its email to a contact.
 * Unresolvable coaches degrade gracefully (no delivery, catalog fallback).
 */

import { sendInviteEmail, sendLoginEmail } from "@/lib/email";
import { v4 as uuidv4 } from "uuid";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function rowsOf(result) {
  return (result && result.rows) || [];
}

/**
 * @param db db handle
 * @param opts { coachContactId?, coachId? } — one or both (contact wins)
 * @returns { cid, name, email } | null
 */
export async function resolveCoachContact(db, { coachContactId = null, coachId = null } = {}) {
  try {
    if (coachContactId) {
      const res = await db.execute({
        sql: "SELECT cid, name, email FROM contacts WHERE cid = ? AND (deleted = 0 OR deleted IS NULL) LIMIT 1",
        args: [String(coachContactId)],
      });
      const contact = rowsOf(res)[0];
      return contact
        ? { cid: contact.cid, name: contact.name || null, email: contact.email || null }
        : null;
    }
    if (coachId) {
      const catalogResult = await db.execute({
        sql: "SELECT email FROM venture_coaches WHERE id = ?",
        args: [coachId],
      }).catch(() => ({ rows: [] }));
      const coachEmail = rowsOf(catalogResult)[0]?.email;
      if (!coachEmail) return null;
      const matchResult = await db.execute({
        sql: "SELECT cid, name, email FROM contacts WHERE LOWER(email) = LOWER(?) AND (deleted = 0 OR deleted IS NULL) LIMIT 1",
        args: [coachEmail],
      });
      const contact = rowsOf(matchResult)[0];
      return contact
        ? { cid: contact.cid, name: contact.name || null, email: contact.email || null }
        : null;
    }
    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Invite a coach to a Venture by email (mirrors the Program facilitator
 * invite blueprint). The coach becomes a PLATFORM USER:
 *   - existing contact (Future Studio staff or any platform user) → assigned
 *     as-is, account role never changed;
 *   - unknown email → new contact created with the narrow 'facilitator' role
 *     (pending until they activate);
 * then an active venture_staff_assignment is created with the chosen
 * responsibility (default 'facilitator') + scope, an activation/login email
 * is sent, and CRM + Venture history events are recorded.
 *
 * Returns per-email status; `preview: true` reports without writing.
 */
export async function inviteCoachByEmail(db, { code, ventureName, email, name = null, responsibilityCode = "facilitator", scopeType = "venture_wide", actorCid = null, preview = false }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
    return { success: true, results: [{ email: cleanEmail, status: "invalid" }], count: 1 };
  }

  const existing = await db.execute({
    sql: "SELECT cid, name, email, password FROM contacts WHERE email = ? AND deleted = 0 AND deleted_at IS NULL LIMIT 1",
    args: [cleanEmail],
  }).catch(() => ({ rows: [] }));
  const row = existing.rows[0];
  const contactCid = row?.cid || null;
  const accountActivated = !!(row && String(row.password || "").trim());

  if (contactCid) {
    const duplicateResult = await db.execute({
      sql: "SELECT 1 FROM venture_staff_assignments WHERE venture_id = ? AND staff_contact_id = ? AND status = 'active' LIMIT 1",
      args: [code, contactCid],
    }).catch(() => ({ rows: [] }));
    if (duplicateResult.rows.length > 0) {
      return { success: true, results: [{ email: cleanEmail, status: "already_assigned", contactCid, name: row.name || "" }], count: 1 };
    }
  }

  if (preview) {
    return {
      success: true,
      results: [
        {
          email: cleanEmail,
          status: contactCid ? "existing_contact" : "new_contact",
          contactCid,
          name: row?.name || name || "",
          accountActivated,
        },
      ],
      count: 1,
    };
  }

  let cid = contactCid;
  if (!cid) {
    cid = "USR_" + uuidv4().toUpperCase().replace(/-/g, "").substring(0, 12);
    await db.execute({
      sql: "INSERT INTO contacts (cid, name, email, role, status) VALUES (?, ?, ?, 'facilitator', 'pending')",
      args: [cid, name ? String(name).slice(0, 120) : "", cleanEmail],
    });
  }

  // Venture assignment (contact-native; scope/authority live here).
  const duplicateResult = await db.execute({
    sql: "SELECT id FROM venture_staff_assignments WHERE venture_id = ? AND staff_contact_id = ? AND status = 'active' LIMIT 1",
    args: [code, cid],
  }).catch(() => ({ rows: [] }));
  if (duplicateResult.rows.length > 0) {
    await db.execute({
      sql: `UPDATE venture_staff_assignments
            SET responsibility_code = ?, scope_type = ?, assigned_by = ?, notes = COALESCE(notes, ?)
            WHERE id = ?`,
      args: [responsibilityCode, scopeType, actorCid || "system", `Invited as ${responsibilityCode} (${ventureName || code})`, duplicateResult.rows[0].id],
    });
  } else {
    await db.execute({
      sql: `INSERT INTO venture_staff_assignments (venture_id, staff_contact_id, responsibility_code, scope_type, assigned_by, notes)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [code, cid, responsibilityCode, scopeType, actorCid || "system", `Invited as ${responsibilityCode} (${ventureName || code})`],
    });
  }

  // Activation/login token — never duplicate pending tokens.
  try {
    await ensureTokenHashColumns();
    await db.execute({ sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ?", args: [cid] }).catch(() => {});
    const token = uuidv4();
    await db.execute({
      sql: "INSERT INTO password_setup_tokens (token, token_hash, contact_cid, expires_at, token_type) VALUES (?, ?, ?, NOW() + INTERVAL '48 hours', 'staff_invite')",
      args: [token, hashToken(token), cid],
    });
    if (accountActivated) {
      await sendLoginEmail({ to: cleanEmail, name: row?.name || name || "", role: "facilitator", programName: ventureName || code, contact_cid: cid });
    } else {
      await sendInviteEmail({ to: cleanEmail, name: row?.name || name || "", role: "facilitator", token, programName: ventureName || code, contact_cid: cid });
    }
  } catch (_) {}

  // CRM history.
  try {
    await db.execute({
      sql: `INSERT INTO contact_timeline (contact_cid, event_type, description, context_module, context_id, actor_id, metadata)
            VALUES (?, 'coach_assigned', ?, 'ventures', ?, ?, '{}'::jsonb)`,
      args: [cid, `Invited as ${responsibilityCode} coach for ${ventureName || code}`, code, actorCid || "system"],
    });
  } catch (_) {}

  return {
    success: true,
    results: [
      {
        email: cleanEmail,
        status: accountActivated ? "invited" : "activation_sent",
        cid,
        name: row?.name || name || "",
        responsibility_code: responsibilityCode,
      },
    ],
    count: 1,
  };
}

export default { resolveCoachContact, inviteCoachByEmail };
