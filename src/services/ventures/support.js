/**
 * services/ventures/support — WHO supports this Venture, and how a founder
 * reaches them.
 *
 * The source is `venture_staff_assignments` and NOTHING else (the coached
 * catalogue in `venture_coach_assignments` is a different, older system and is
 * deliberately not merged here). The read is `listAssignments`, the same one the
 * admin permissions screen uses, so the founder, the Lead Manager and the Super
 * Admin can never be told three different stories about who is assigned.
 *
 * ── FOUR RULES ──────────────────────────────────────────────────────────────
 *
 * 1. THE PRIMARY IS DERIVED, NEVER STORED. The oldest ACTIVE `lead_manager` is the
 *    primary contact. No column, no migration, no second source of truth.
 *
 * 2. NO ACTIVE LEAD IS STATED, NOT HIDDEN. When every lead has been removed, the
 *    most recently removed one is still shown — in the primary slot, flagged as
 *    no longer assigned — so a founder is never left with a blank card and no
 *    explanation (and never silently talks to nobody).
 *
 * 3. THE PAST IS KEPT, BOUNDED. Former leads come back newest first, capped at
 *    five. The query returns every historical row; the cap belongs here, not in
 *    the payload.
 *
 * 4. A FOUNDER'S MESSAGE IS TEXT, NOT MARKUP. The body is escaped before it is
 *    rendered into an email, and the recipient is ALWAYS derived server-side from
 *    the assignment rows — never taken from the request.
 *
 * Reads through `@/services/ventures/permissions` and `@/lib/email`; runs no SQL,
 * speaks no HTTP, and writes no table of its own.
 */

import { listAssignments } from "@/services/ventures/permissions";
import { normalizeEmail } from "@/services/reminders/recipients";
import {
  createMessage,
  ensureMessagesIsReadColumn,
  insertDirectMessageNotification,
} from "@/models/communications";

/** The responsibility whose holder is the Venture's day-to-day contact. */
export const LEAD_RESPONSIBILITY = "lead_manager";

/** How many former supporters the founder can reopen (newest first). */
export const FORMER_SUPPORT_LIMIT = 5;

/** A founder message longer than this is refused, not truncated. */
export const MAX_MESSAGE_LENGTH = 2000;

/** Everyone this Venture's founder may write to: active lead managers. */
export function activeLeadRecipients(support) {
  return (support?.current || []).filter(
    (person) => person.responsibility_code === LEAD_RESPONSIBILITY,
  );
}

/** A stable order for "who came first": assignment date, then id. */
function byAssignedAt(left, right) {
  const leftAt = String(left.assigned_at || "");
  const rightAt = String(right.assigned_at || "");
  if (leftAt !== rightAt) return leftAt < rightAt ? -1 : 1;
  return Number(left.id || 0) - Number(right.id || 0);
}

/** Newest removal first. */
function byRemovedAt(left, right) {
  const leftAt = String(left.removed_at || "");
  const rightAt = String(right.removed_at || "");
  if (leftAt !== rightAt) return leftAt < rightAt ? 1 : -1;
  return Number(right.id || 0) - Number(left.id || 0);
}

/**
 * One assignment row → the shape a founder may see.
 *
 * Deliberately absent: `assigned_by`, `notes`, `scope_ref_id`, `scope_ref_type`.
 * Those are staff-internal and have no business on a founder's screen.
 */
function shapePerson(row) {
  const email = normalizeEmail(row.staff_email);
  return {
    id: row.id,
    contact_cid: row.staff_contact_id ? String(row.staff_contact_id) : null,
    responsibility_code: row.responsibility_code || null,
    // The CONFIGURED responsibility name (administrative wording, preserved).
    responsibility_label: row.responsibility_name || row.responsibility_code || null,
    name: row.staff_name || null,
    email,
    // A leader with no usable address is reported, never dropped silently.
    reachable: Boolean(email),
    // A lead with an ImpactOS account has an inbox: that is where a founder's
    // message is written (see sendFounderMessageToLeads).
    has_account: Boolean(row.staff_contact_id),
    scope_type: row.scope_type || "venture_wide",
    assigned_at: row.created_at || null,
    removed_at: row.removed_at || null,
    active: String(row.status || "").toLowerCase() === "active",
    is_primary: false,
  };
}

/**
 * Shape the assignment rows for a founder.
 *
 * @param {object[]} assignments rows from `listAssignments(ventureId, { includeRemoved: true })`
 * @returns {{current: object[], primary: object|null, has_active_lead: boolean,
 *            former: object[], former_total: number}}
 */
export function shapeVentureSupport(assignments = []) {
  const people = (assignments || []).filter(Boolean).map(shapePerson);

  const active = people.filter((person) => person.active).sort(byAssignedAt);
  const removed = people.filter((person) => !person.active).sort(byRemovedAt);

  // Rule 1 — the primary is the oldest ACTIVE lead manager.
  const primary = active.find((person) => person.responsibility_code === LEAD_RESPONSIBILITY) || null;
  if (primary) primary.is_primary = true;

  // Rule 2 — no active lead: the most recently removed lead takes the primary
  // slot and says so, instead of the card going blank.
  let former = removed;
  let unassignedPrimary = null;
  if (!primary) {
    const index = removed.findIndex((person) => person.responsibility_code === LEAD_RESPONSIBILITY);
    if (index >= 0) {
      unassignedPrimary = { ...removed[index], is_primary: true, active: false };
      former = removed.filter((_, position) => position !== index);
    }
  }

  return {
    current: active,
    primary: primary || unassignedPrimary,
    has_active_lead: Boolean(primary),
    // Rule 3 — bounded history, newest first.
    former: former.slice(0, FORMER_SUPPORT_LIMIT),
    former_total: former.length,
  };
}

/** The founder's view of this Venture's support assignments. */
export async function readVentureSupport(ventureId) {
  const assignments = await listAssignments(ventureId, { includeRemoved: true });
  return shapeVentureSupport(assignments);
}

/**
 * Write a founder's message to their Venture Leads — in the platform's own
 * MESSAGE SPACE, not by email.
 *
 * Each chosen lead receives a direct message in their ImpactOS inbox (the same
 * one the Messages screen reads), from the founder, plus the usual "new message"
 * notification, and the conversation is then visible to the founder too. The
 * recipients are passed IN, already resolved from the assignment rows, so this
 * cannot be made to message anyone a request body named. A lead with no account
 * has no inbox: they are reported back, never dropped, and never block the rest.
 *
 * @returns {Promise<{sent:number, failed:{name:string|null, reason:string}[]}>}
 */
export async function sendFounderMessageToLeads({
  ventureName,
  founderCid,
  founderName,
  message,
  leads = [],
}) {
  const sender = String(founderName || "").trim() || "A founder";
  const venture = String(ventureName || "").trim() || "your Venture";
  const subject = `${venture} — message from ${sender}`;
  const body = String(message || "").trim();

  try {
    await ensureMessagesIsReadColumn();
  } catch (_) {
    /* the column is added on first use; an existing one is fine */
  }

  const failed = [];
  let sent = 0;
  for (const lead of leads) {
    if (!lead?.contact_cid) {
      failed.push({ name: lead?.name || null, reason: "no_account" });
      continue;
    }
    try {
      await createMessage({
        senderId: founderCid,
        recipientId: String(lead.contact_cid),
        targetType: "individual",
        subject,
        body,
        priority: "normal",
      });
      sent += 1;
      try {
        await insertDirectMessageNotification(
          String(lead.contact_cid),
          "New Message",
          `You have 1 new message from ${sender}`,
        );
      } catch (_) {
        /* the message is in the inbox either way */
      }
    } catch (error) {
      failed.push({ name: lead.name || null, reason: error?.message || "send_failed" });
    }
  }

  return { sent, failed };
}
