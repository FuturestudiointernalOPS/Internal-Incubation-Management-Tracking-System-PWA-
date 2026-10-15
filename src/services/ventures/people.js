/**
 * THE PEOPLE a Venture's work names (SERVICE layer).
 *
 * A tracker writes names, not accounts: "Amina" owns nine activities, "David,
 * Grace" support three more. This module answers the two questions a manager
 * actually has — WHO is still only a name here, and WHICH PERSON is each of them
 * — and it answers them once for the whole Venture, because a name is the
 * reference everywhere it appears.
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

import { listExternalAssignees } from "@/models/ventureAssignments";
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

/**
 * Every name this Venture's work stands on, with who they turned out to be.
 *
 * Answers, in one pass: which names own work and how much, which names support
 * it, which are identified to a contact, and where a reminder would be sent.
 *
 * @returns {Promise<{people: object[], summary: object}>}
 */
export async function listVenturePeople({ ventureCode, dbId } = {}) {
  const [externalNames, workItems, linkRows, emailRows] = await Promise.all([
    // Owners whose assignments carry no identity — the names still only names.
    listExternalAssignees({ dbId }).catch(readFailure("external assignees")),
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

  // ── One entry per name, from both places a name can appear. ────────────────
  const byName = new Map();
  const remember = (rawName) => {
    const key = nameKey(rawName);
    let entry = byName.get(key);
    if (!entry) {
      entry = { name: String(rawName || "").trim(), roles: new Set(), assignments: 0, levels: {}, supporting_items: 0 };
      byName.set(key, entry);
    }
    return entry;
  };

  for (const row of externalNames) {
    const entry = remember(row.name);
    entry.roles.add("owner");
    entry.assignments += Number(row.total || 0);
    for (const [level, count] of Object.entries(row.levels || {})) {
      entry.levels[level] = (entry.levels[level] || 0) + Number(count || 0);
    }
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

  const cids = [...new Set([...linkByKey.values()].filter(Boolean))];
  const contactRows = cids.length ? ((await selectContactEmailsByCids(cids)).rows || []) : [];
  const contactByCid = new Map(contactRows.map((row) => [String(row.cid), row]));

  const people = [...byName.values()]
    .map((entry) => {
      const key = nameKey(entry.name);
      const contactCid = linkByKey.get(key) || null;
      const contact = contactCid ? contactByCid.get(String(contactCid)) || null : null;
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
        contact: contactCid
          ? { cid: String(contactCid), name: contact?.name || null, email: contact?.email || null }
          : null,
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

/** Forget who one name is. The name, and every assignment, are untouched. */
export async function unlinkName({ ventureCode, displayName } = {}) {
  const name = String(displayName || "").trim();
  if (!name) return { error: "display_name required" };
  await deleteAssigneeLink({ ventureId: ventureCode, displayName: name });
  return { unlinked: { display_name: name } };
}
