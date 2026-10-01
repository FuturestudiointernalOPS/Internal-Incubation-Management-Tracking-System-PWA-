/**
 * CONTACT TIMELINE — the read/add use-cases.
 *
 * A contact's timeline is readable by internal roles, but a participant or
 * founder may only read their OWN; a program manager sees the non-program events
 * plus the events of the programs they run. New events are always authored by
 * the caller. Those decisions live here; the capability gates and the envelope
 * stay on the route. Reads and writes go through `@/models/contacts`; nothing
 * here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import {
  getProgramIdsForPm,
  getContactTimelineEvents,
  getTimelineContactIdentity,
  createContactTimelineEvent,
} from "@/models/contacts";

/** Whether this caller may read this contact's timeline (own-record for members). */
export function mayReadContactTimeline(session, cid) {
  if (session.role === "participant" || session.role === "founder") {
    return session.cid === cid;
  }
  return true;
}

/** The scoped timeline plus the contact's identity. */
export async function listContactTimeline(session, cid, { moduleFilter, typeFilter, limit, offset }) {
  // Program managers: scope events to non-program modules + their programs.
  let pmProgramIds;
  if (session.role === "program_manager") {
    const programsResult = await getProgramIdsForPm(session.cid);
    pmProgramIds = programsResult.rows.map((row) => row.id);
  }

  const result = await getContactTimelineEvents(
    cid,
    moduleFilter,
    typeFilter,
    pmProgramIds,
    limit,
    offset,
  );
  const contactResult = await getTimelineContactIdentity(cid);

  return {
    contact: contactResult.rows[0] || null,
    events: result.rows,
    total: result.rows.length,
  };
}

/** Append a timeline event authored by the caller. */
export async function addContactTimelineEvent({ cid, eventType, description, actorCid, metadata }) {
  const result = await createContactTimelineEvent(cid, eventType, description, actorCid, metadata);
  return result.rows[0];
}
