/**
 * Who a reminder is sent to (SERVICE layer).
 *
 * A work item names an Owner and, sometimes, the people supporting them. Turning
 * those NAMES into addresses is the one part that can lose a reminder silently,
 * so the rule is explicit:
 *
 *   - the address on file for this Venture (typed in the reminder bar) WINS when
 *     present — editing it must change who the next send reaches;
 *   - otherwise a person WITH a platform account is asked for the address on
 *     their contact record;
 *   - anyone left without an address is still RETURNED, with `reason` saying why.
 *
 * That last point is the whole design. An assignee with no address is not
 * "handled" and not dropped: they come back as a recipient with no email, so the
 * screen can say "no email on file" and offer to add one. A reminder that cannot
 * be delivered must be visible, never merely absent.
 *
 * Reads through `@/models/**`, runs no SQL, speaks no HTTP.
 */

import {
  selectAssigneeEmails,
  selectContactCidByEmail,
  selectContactEmailsByCids,
} from "@/models/ventureAssigneeEmails";

/** Deliberately simple: one @, something either side, a dot in the domain. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A trimmed, lower-cased address, or null when it could never be sent to. */
export function normalizeEmail(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return EMAIL_SHAPE.test(text) ? text : null;
}

/** Why a recipient has no address — the words the screen shows. */
export const NO_EMAIL_REASONS = {
  external_without_email: "external_without_email",
  contact_removed: "contact_removed",
  invalid_on_file: "invalid_on_file",
};

/** One recipient, for display. `email` null means "cannot be reminded yet". */
function recipient({ name, role, cid, email, source, reason = null }) {
  return { name: name || null, role, cid: cid ? String(cid) : null, email, source, reason };
}

/**
 * The people a reminder for ONE work item should reach.
 *
 * @param {object} input
 * @param {string} input.ventureId    — the Venture the addresses on file belong to
 * @param {object} input.item         — a work item, as `buildWorkItems` shapes it
 * @param {boolean} [input.includeOwner=true]
 * @param {boolean} [input.includeSupporting=false]
 * @returns {Promise<object[]>} recipients in owner-then-supporting order, deduped
 */
export async function resolveWorkItemRecipients({
  ventureId,
  item,
  includeOwner = true,
  includeSupporting = false,
} = {}) {
  const wanted = [];
  if (includeOwner && item?.owner?.name) {
    wanted.push({ name: String(item.owner.name).trim(), cid: item.owner.cid || null, role: "owner" });
  }
  if (includeSupporting) {
    for (const name of item?.supporting_names || []) {
      wanted.push({ name: String(name).trim(), cid: null, role: "supporting" });
    }
  }
  if (wanted.length === 0) return [];

  // The people who have an account: their own address.
  const cids = [...new Set(wanted.map((entry) => entry.cid).filter(Boolean))];
  const contactRows = cids.length ? (await selectContactEmailsByCids(cids)).rows || [] : [];
  const contactByCid = new Map(contactRows.map((row) => [String(row.cid), row]));

  // Everyone else: the address on file for the name, for this Venture.
  const onFileRows = (await selectAssigneeEmails(ventureId).catch(() => ({ rows: [] }))).rows || [];
  const onFileByName = new Map(
    onFileRows.map((row) => [String(row.display_name ?? "").trim().toLowerCase(), String(row.email ?? "")]),
  );

  const resolve = (entry) => {
    const hasRow = onFileByName.has(entry.name.toLowerCase());
    const typed = normalizeEmail(onFileByName.get(entry.name.toLowerCase()));

    // Manager-set address for this Venture takes precedence so "change email"
    // in the reminder bar actually changes the next send's recipient.
    if (typed) return recipient({ ...entry, email: typed, source: "on_file" });
    if (hasRow) {
      return recipient({
        ...entry,
        email: null,
        source: null,
        reason: NO_EMAIL_REASONS.invalid_on_file,
      });
    }

    if (entry.cid) {
      const contact = contactByCid.get(String(entry.cid));
      const deleted = Boolean(contact?.deleted) && String(contact.deleted) !== "0";
      const own = deleted ? null : normalizeEmail(contact?.email);
      if (own) return recipient({ ...entry, email: own, source: "contact" });
      return recipient({
        ...entry,
        email: null,
        source: null,
        reason: deleted ? NO_EMAIL_REASONS.contact_removed : NO_EMAIL_REASONS.external_without_email,
      });
    }

    // A name the tracker wrote, with nothing anywhere to write to. Returned ON
    // PURPOSE: this is the row that lets the screen offer "add an email".
    return recipient({
      ...entry,
      email: null,
      source: null,
      reason: NO_EMAIL_REASONS.external_without_email,
    });
  };

  // One address is one message: a person who is both owner and supporting, or
  // named twice in a support list, is told once. Owner wins the role shown.
  const seen = new Set();
  const out = [];
  for (const entry of wanted) {
    const resolved = resolve(entry);
    const identity = resolved.email || `name:${String(resolved.name).toLowerCase()}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    out.push(resolved);
  }
  return out;
}

/**
 * The addresses a send would actually reach, and the people it would miss.
 * A reminder with nobody reachable is a real answer — the caller says so.
 */
export function splitReachable(recipients = []) {
  return {
    reachable: recipients.filter((entry) => entry.email),
    unreachable: recipients.filter((entry) => !entry.email),
  };
}

/**
 * Whether a recipient can sign in to ImpactOS — it decides where the email's
 * button leads: the login page for someone with an account, registration for
 * someone without one.
 *
 * An address read from a contact record is an account by definition. An address
 * typed by hand may still belong to someone who registered since, so it is
 * looked up. A failed lookup answers "account": the login page is the safer
 * guess, since a sign-up form would file a duplicate request for someone who is
 * already registered.
 */
export async function hasPlatformAccount(recipient = {}) {
  if (recipient.source === "contact") return true;
  const email = normalizeEmail(recipient.email);
  if (!email) return false;
  try {
    const found = await selectContactCidByEmail(email);
    return Boolean(found?.rows?.length);
  } catch {
    return true;
  }
}
