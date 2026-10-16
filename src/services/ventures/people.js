/**
 * THE PEOPLE a Venture's work names (SERVICE layer).
 *
 * A tracker writes names, not accounts: "Amina" owns nine activities, "David,
 * Grace" support three more. This module answers the two questions a manager
 * actually has — WHO is still only a name here, and WHICH PERSON is each of them
 * — and it answers them once for the whole Venture, because a name is the
 * reference everywhere it appears.
 *
 * ONE DECISION, TWO PLACES IT COULD BE WRITTEN. An identity can be recorded
 * against the name (a decision about the whole Venture, taken on the People
 * screen) or on a single assignment's own row (the older, per-row path). Both are
 * read here so the screen never calls a name unidentified while its work says
 * otherwise, and BOTH ARE CLEARED together when a name is let go — a "forget"
 * that left rows pointing at somebody would make the two records drift apart.
 * The name decision is the one that decides where mail goes (see
 * `@/services/reminders/recipients`), because it is the one the screen shows.
 *
 * THE LINK IT WRITES CREATES NOTHING. No contact, no member, no invitation and no
 * platform access: it points at a contact that already exists, and the name the
 * tracker wrote is never rewritten. Identifying a name grants nothing either —
 * being assigned work has never been membership.
 *
 * The address question is NOT decided here: it is asked of the reminder layer
 * (`chooseRecipientEmail`), so the screen and the send can never disagree about
 * where a reminder would go.
 *
 * Reads through `@/models/**` and `@/services/workItems`; runs no SQL, speaks no
 * HTTP.
 */

import {
  clearAssignmentIdentities,
  listAssignmentIdentities,
  listExternalAssignees,
} from "@/models/ventureAssignments";
import { selectAssigneeEmails, selectContactEmailsByCids } from "@/models/ventureAssigneeEmails";
import {
  deleteAssigneeLink,
  selectAssigneeLinks,
  upsertAssigneeLink,
} from "@/models/ventureAssigneeLinks";
import { buildWorkItems } from "@/services/workItems";
import { chooseRecipientEmail, nameKey, normalizeEmail } from "@/services/reminders/recipients";

/** A failed read is reported and degrades to "no rows", never to a blank screen. */
function readFailure(label) {
  return (error) => {
    console.error(`[venture-people] ${label} read failed:`, error?.message || error);
    return [];
  };
}

/** A contact, in the small shape the screen shows. */
function contactShape(cid, row) {
  return { cid: String(cid), name: row?.name || null, email: row?.email || null };
}

/**
 * Every name this Venture's work stands on, with who they turned out to be.
 *
 * Answers, in one pass: which names own work and how much, which names support
 * it, which are identified and BY WHICH DECISION, and where a reminder would be
 * sent.
 *
 * @returns {Promise<{people: object[], summary: object}>}
 */
export async function listVenturePeople({ ventureCode, dbId } = {}) {
  const [externalNames, identifiedNames, workItems, linkRows, emailRows] = await Promise.all([
    // Owners whose assignments carry no identity — the names still only names.
    listExternalAssignees({ dbId }).catch(readFailure("external assignees")),
    // Names whose assignments ALREADY carry an identity — the other half of the
    // same question, so the screen can tell the whole truth.
    listAssignmentIdentities({ dbId }).catch(readFailure("assignment identities")),
    buildWorkItems({ dbId, ventureCode })
      .then((result) => result.items || [])
      .catch(readFailure("work items")),
    selectAssigneeLinks(ventureCode)
      .then((result) => result.rows || [])
      .catch(readFailure("links")),
    selectAssigneeEmails(ventureCode)
      .then((result) => result.rows || [])
      .catch(readFailure("addresses on file")),
  ]);

  // ── One entry per name, from every place a name can appear. ────────────────
  const byName = new Map();
  const remember = (rawName) => {
    const key = nameKey(rawName);
    let entry = byName.get(key);
    if (!entry) {
      entry = {
        name: String(rawName || "").trim(),
        roles: new Set(),
        assignments: 0,
        levels: {},
        supporting_items: 0,
        row_cids: [],
      };
      byName.set(key, entry);
    }
    return entry;
  };

  const addAssignments = (entry, total, levels) => {
    entry.roles.add("owner");
    entry.assignments += Number(total || 0);
    for (const [level, count] of Object.entries(levels || {})) {
      entry.levels[level] = (entry.levels[level] || 0) + Number(count || 0);
    }
  };

  for (const row of externalNames) addAssignments(remember(row.name), row.total, row.levels);
  for (const row of identifiedNames) {
    const entry = remember(row.name);
    addAssignments(entry, row.total, row.levels);
    for (const cid of row.cids || []) if (!entry.row_cids.includes(String(cid))) entry.row_cids.push(String(cid));
  }
  for (const item of workItems) {
    for (const name of item.supporting_names || []) {
      const entry = remember(name);
      entry.roles.add("supporting");
      entry.supporting_items += 1;
    }
  }

  // ── What is already known about each name. ─────────────────────────────────
  const linkByKey = new Map(linkRows.map((row) => [nameKey(row.display_name), String(row.contact_cid || "")]));
  const emailByKey = new Map(emailRows.map((row) => [nameKey(row.display_name), String(row.email ?? "")]));

  // Every contact any name points at, so a disagreement between the two records
  // can be shown rather than hidden.
  const cids = new Set();
  for (const cid of linkByKey.values()) if (cid) cids.add(cid);
  for (const entry of byName.values()) for (const cid of entry.row_cids) cids.add(cid);
  const contactRows = cids.size ? ((await selectContactEmailsByCids([...cids])).rows || []) : [];
  const contactByCid = new Map(contactRows.map((row) => [String(row.cid), row]));

  const people = [...byName.values()]
    .map((entry) => {
      const key = nameKey(entry.name);
      const linkedCid = linkByKey.get(key) || null;
      // The name decision wins — the same precedence the send applies.
      const contactCid = linkedCid || entry.row_cids[0] || null;
      const contact = contactCid ? contactByCid.get(String(contactCid)) || null : null;
      const otherCid = linkedCid ? entry.row_cids.find((cid) => cid !== linkedCid) || null : null;
      // The SAME decision the send makes — asked, not re-implemented.
      const chosen = chooseRecipientEmail({
        typedEmail: normalizeEmail(emailByKey.get(key)),
        hasTypedAddress: emailByKey.has(key),
        contactCid,
        contact,
      });

      return {
        name: entry.name,
        roles: [...entry.roles],
        assignments: entry.assignments,
        levels: entry.levels,
        supporting_items: entry.supporting_items,
        email_on_file: emailByKey.get(key) || null,
        contact: contactCid ? contactShape(contactCid, contact) : null,
        // Which decision identified them: the name, or the assignments themselves.
        contact_source: linkedCid ? "name" : entry.row_cids.length ? "assignment" : null,
        // The other record disagrees. Reported, never settled quietly.
        alternative_contact: otherCid ? contactShape(otherCid, contactByCid.get(String(otherCid))) : null,
        email: chosen.email,
        source: chosen.source,
        reason: chosen.reason,
        alternative_email: chosen.alternative_email,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  const summary = {
    total: people.length,
    identified: people.filter((entry) => entry.contact).length,
    unidentified: people.filter((entry) => !entry.contact).length,
    reachable: people.filter((entry) => entry.email).length,
    unreachable: people.filter((entry) => !entry.email).length,
  };

  return { people, summary };
}

/**
 * Decide WHO one name is, for the whole Venture.
 *
 * The contact must ALREADY EXIST — this refuses to invent one, which is the whole
 * point. A contact that was removed is refused too: linking to somebody the
 * platform no longer knows would produce an identity that cannot be reached.
 */
export async function linkNameToContact({ ventureCode, displayName, contactCid, actorCid = null } = {}) {
  const name = String(displayName || "").trim();
  const cid = String(contactCid || "").trim();
  if (!name) return { error: "display_name required" };
  if (!cid) return { error: "contact_id required" };

  const found = await selectContactEmailsByCids([cid]);
  const contact = ((found && found.rows) || [])[0];
  if (!contact) return { error: "errors.notFound" };
  if (Boolean(contact.deleted) && String(contact.deleted) !== "0") return { error: "errors.notFound" };

  await upsertAssigneeLink({ ventureId: ventureCode, displayName: name, contactCid: cid, actorCid });

  return {
    linked: {
      display_name: name,
      contact: { cid: String(contact.cid), name: contact.name || null, email: contact.email || null },
    },
  };
}

/**
 * Forget who one name is — BOTH records of it.
 *
 * The name link goes, and so does any identity written on that name's own
 * assignments. Leaving the second behind would mean a name that reads as free on
 * the screen while its work still points at somebody, which is exactly the drift
 * this feature exists to end.
 */
export async function unlinkName({ ventureCode, dbId = null, displayName, actorCid = null } = {}) {
  const name = String(displayName || "").trim();
  if (!name) return { error: "display_name required" };

  await deleteAssigneeLink({ ventureId: ventureCode, displayName: name });
  const onAssignments = dbId
    ? await clearAssignmentIdentities({ dbId, displayName: name, actorCid }).catch(() => ({ cleared: 0 }))
    : { cleared: 0 };

  return { unlinked: { display_name: name, cleared_assignments: (onAssignments && onAssignments.cleared) || 0 } };
}
