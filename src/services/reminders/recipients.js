/**
 * Who a reminder is sent to, and WHERE (SERVICE layer).
 *
 * A work item names an Owner and, sometimes, the people supporting them. Turning
 * those NAMES into addresses is the one part that can lose a reminder silently,
 * so the rule is explicit — and it is a single rule, applied in one place:
 *
 *   1. SOMEONE IDENTIFIED is asked for the address on their record. An identity
 *      comes from a decision made once for the whole Venture ("this Amina is
 *      that contact", taken on the People screen) or, failing that, from the
 *      assignment itself. The NAME decision wins because it is the one the
 *      screen shows and edits — a decision that did not take effect would make
 *      the screen a liar.
 *   2. Failing that, an address typed by hand for this Venture and this name.
 *   3. Anyone still without an address is RETURNED, with `reason` saying why.
 *
 * That first rule is also what makes the SUPPORTING people reachable: a support
 * list is text and can hold no identifier of its own, so a decision taken about
 * the name is the only thing that can identify them.
 *
 * THE IDENTITY WINS OVER THE TYPED ADDRESS, deliberately. The two used to
 * disagree: the typed address won, so linking a name to a person changed nothing
 * about where the mail went and the link was decorative. Now identifying someone
 * is what decides, and a typed address is the fallback for a person with no
 * identity — or for one whose record holds no usable address, so nobody is
 * stranded by a gap in their record.
 *
 * When both exist and differ, the one NOT used is returned as
 * `alternative_email`: a contradiction a human should see, never one this code
 * should settle quietly.
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
import { selectAssigneeLinks } from "@/models/ventureAssigneeLinks";

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

/** A contact row as "removed" — the flag is a 0/1 or a boolean, depending on the driver. */
function isRemovedContact(contact) {
  return Boolean(contact?.deleted) && String(contact.deleted) !== "0";
}

/** Normal form for the key every name is looked up by. */
export function nameKey(name) {
  return String(name ?? "").trim().toLowerCase();
}

/**
 * WHICH ADDRESS, and why — the single decision every caller shares.
 *
 * @param {object} input
 * @param {string|null} input.typedEmail      — the address on file, already normalised
 * @param {boolean} input.hasTypedAddress     — whether a row exists for the name at all,
 *                                              so "unusable address" is distinguishable
 *                                              from "nothing recorded"
 * @param {string|null} input.contactCid      — the identity, when the name has one
 * @param {object|null} input.contact         — that contact's record, when it was found
 * @returns {{email: string|null, source: string|null, reason: string|null, alternative_email: string|null}}
 */
export function chooseRecipientEmail({ typedEmail = null, hasTypedAddress = false, contactCid = null, contact = null } = {}) {
  const none = { email: null, source: null, reason: null, alternative_email: null };

  // ── Identified: the record speaks. ─────────────────────────────────────────
  if (contactCid) {
    const removed = isRemovedContact(contact);
    const own = removed ? null : normalizeEmail(contact?.email);
    if (own) {
      return {
        email: own,
        source: "contact",
        reason: null,
        // A different address on file for this name is a contradiction worth
        // showing, not a value to silently prefer.
        alternative_email: typedEmail && typedEmail !== own ? typedEmail : null,
      };
    }
    // The record holds nothing usable — an address on file is then the only way
    // to reach them, and reaching them matters more than which field it came from.
    if (typedEmail) {
      return { email: typedEmail, source: "on_file", reason: null, alternative_email: null };
    }
    return {
      ...none,
      reason: removed ? NO_EMAIL_REASONS.contact_removed : NO_EMAIL_REASONS.external_without_email,
    };
  }

  // ── Not identified: an address on file is all there is. ────────────────────
  if (typedEmail) return { email: typedEmail, source: "on_file", reason: null, alternative_email: null };
  if (hasTypedAddress) return { ...none, reason: NO_EMAIL_REASONS.invalid_on_file };
  // A name the tracker wrote, with nothing anywhere to write to. Returned ON
  // PURPOSE: this is the row that lets the screen offer "add an email".
  return { ...none, reason: NO_EMAIL_REASONS.external_without_email };
}

/** One recipient, for display. `email` null means "cannot be reminded yet". */
function recipient({ name, role, cid, email, source, reason = null, alternative_email = null }) {
  return {
    name: name || null,
    role,
    cid: cid ? String(cid) : null,
    email,
    source,
    reason,
    alternative_email,
  };
}

/**
 * The people a reminder for ONE work item should reach.
 *
 * @param {object} input
 * @param {string} input.ventureId    — the Venture the addresses and identities belong to
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

  // The names this Venture has already identified. A support list is text, so the
  // name is the only handle those people have — this is where it pays off.
  const linkRows = (await selectAssigneeLinks(ventureId).catch(() => ({ rows: [] }))).rows || [];
  const linkByName = new Map(
    linkRows.map((row) => [nameKey(row.display_name), String(row.contact_cid ?? "")]),
  );

  // Everyone who has an identity now, and WHICH of the two decisions gave it to
  // them. A decision taken about the NAME wins over one written on a single
  // assignment: the People screen is where the name decision is made and undone,
  // and what it shows has to be what happens.
  const identified = wanted.map((entry) => ({
    ...entry,
    cid: linkByName.get(nameKey(entry.name)) || entry.cid || null,
  }));

  // The people who have an account: their own address.
  const cids = [...new Set(identified.map((entry) => entry.cid).filter(Boolean))];
  const contactRows = cids.length ? (await selectContactEmailsByCids(cids)).rows || [] : [];
  const contactByCid = new Map(contactRows.map((row) => [String(row.cid), row]));

  // Everyone else: the address on file for the name, for this Venture.
  const onFileRows = (await selectAssigneeEmails(ventureId).catch(() => ({ rows: [] }))).rows || [];
  const onFileByName = new Map(
    onFileRows.map((row) => [nameKey(row.display_name), String(row.email ?? "")]),
  );

  const resolve = (entry) => {
    const key = nameKey(entry.name);
    const chosen = chooseRecipientEmail({
      typedEmail: normalizeEmail(onFileByName.get(key)),
      hasTypedAddress: onFileByName.has(key),
      contactCid: entry.cid,
      contact: entry.cid ? contactByCid.get(String(entry.cid)) : null,
    });
    return recipient({ ...entry, ...chosen });
  };

  // One address is one message: a person who is both owner and supporting, or
  // named twice in a support list, is told once. Owner wins the role shown.
  const seen = new Set();
  const out = [];
  for (const entry of identified) {
    const resolved = resolve(entry);
    const identity = resolved.email || `name:${nameKey(resolved.name)}`;
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
