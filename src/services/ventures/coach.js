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
 *
 * Every statement lives in `@/models/ventureCoachStore`; nothing here runs SQL.
 * Re-exported unchanged through the compatibility facade `@/lib/ventureCoach` —
 * see docs/LAYER_SPLIT.md.
 */

import { sendInviteEmail, sendLoginEmail } from "@/lib/email";
import { v4 as uuidv4 } from "uuid";
import { hashToken, ensureTokenHashColumns } from "@/lib/token-hashing";
import {
  selectCoachContactById,
  selectCatalogCoachEmail,
  selectCoachContactByLowerEmail,
  selectInvitableContactByEmail,
  selectActiveAssignmentProbe,
  selectActiveAssignmentId,
  insertCoachContact,
  updateCoachAssignment,
  insertCoachAssignment,
  invalidatePasswordSetupTokens,
  insertPasswordSetupToken,
  insertCoachTimeline,
} from "@/models/ventureCoachStore";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function rowsOf(result) {
  return (result && result.rows) || [];
}

/**
 * @param opts { coachContactId?, coachId? } — one or both (contact wins)
 * @returns { cid, name, email } | null
 */
export async function resolveCoachContact({ coachContactId = null, coachId = null } = {}) {
  try {
    if (coachContactId) {
      const contact = rowsOf(await selectCoachContactById(coachContactId))[0];
      return contact
        ? { cid: contact.cid, name: contact.name || null, email: contact.email || null }
        : null;
    }
    if (coachId) {
      const catalogResult = await selectCatalogCoachEmail(coachId).catch(() => ({ rows: [] }));
      const coachEmail = rowsOf(catalogResult)[0]?.email;
      if (!coachEmail) return null;
      const contact = rowsOf(await selectCoachContactByLowerEmail(coachEmail))[0];
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
export async function inviteCoachByEmail({ code, ventureName, email, name = null, responsibilityCode = "facilitator", scopeType = "venture_wide", actorCid = null, preview = false }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
    return { success: true, results: [{ email: cleanEmail, status: "invalid" }], count: 1 };
  }

  const existing = await selectInvitableContactByEmail(cleanEmail).catch(() => ({ rows: [] }));
  const row = existing.rows[0];
  const contactCid = row?.cid || null;
  const accountActivated = !!(row && String(row.password || "").trim());

  if (contactCid) {
    const duplicateResult = await selectActiveAssignmentProbe(code, contactCid).catch(() => ({ rows: [] }));
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
    await insertCoachContact(cid, name ? String(name).slice(0, 120) : "", cleanEmail);
  }

  // Venture assignment (contact-native; scope/authority live here).
  const duplicateResult = await selectActiveAssignmentId(code, cid).catch(() => ({ rows: [] }));
  if (duplicateResult.rows.length > 0) {
    await updateCoachAssignment(
      duplicateResult.rows[0].id,
      responsibilityCode,
      scopeType,
      actorCid || "system",
      `Invited as ${responsibilityCode} (${ventureName || code})`,
    );
  } else {
    await insertCoachAssignment(
      code,
      cid,
      responsibilityCode,
      scopeType,
      actorCid || "system",
      `Invited as ${responsibilityCode} (${ventureName || code})`,
    );
  }

  // Activation/login token — never duplicate pending tokens.
  try {
    await ensureTokenHashColumns();
    await invalidatePasswordSetupTokens(cid).catch(() => {});
    const token = uuidv4();
    await insertPasswordSetupToken(token, hashToken(token), cid);
    if (accountActivated) {
      await sendLoginEmail({ to: cleanEmail, name: row?.name || name || "", role: "facilitator", programName: ventureName || code, contact_cid: cid });
    } else {
      await sendInviteEmail({ to: cleanEmail, name: row?.name || name || "", role: "facilitator", token, programName: ventureName || code, contact_cid: cid });
    }
  } catch (_) {}

  // CRM history.
  try {
    await insertCoachTimeline(cid, `Invited as ${responsibilityCode} coach for ${ventureName || code}`, code, actorCid || "system");
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
