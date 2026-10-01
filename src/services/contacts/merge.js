/**
 * CONTACT MERGE — the preview and merge use-cases.
 *
 * Merging folds a duplicate contact into a survivor: its program enrollments,
 * venture memberships and timeline events move across, the survivor's context
 * grants are reconciled (so a merged founder keeps working access), a merge event
 * is written, the duplicate is soft-deleted with its email freed, and the
 * duplicate flags are resolved. The preview counts what would move.
 *
 * Reads and writes go through `@/models/contacts`; nothing here runs SQL.
 *
 * See docs/LAYER_SPLIT.md.
 */

import {
  reassignContactPrograms,
  reassignContactVentures,
  reassignContactTimelineEvents,
  createContactMergeTimelineEvent,
  softDeleteDuplicateContact,
  resolveDuplicateFlagsForMerge,
  countMergeParticipantPrograms,
  countMergeVentureMemberships,
  countMergeTimelineEvents,
} from "@/models/contacts";
import { syncContextGrantsForUser } from "@/services/authorization/contextGrants";

/** What a merge would move from the duplicate into the survivor. */
export async function previewContactMerge(duplicateCid) {
  const [programs, ventures, timeline] = await Promise.all([
    countMergeParticipantPrograms(duplicateCid),
    countMergeVentureMemberships(duplicateCid),
    countMergeTimelineEvents(duplicateCid),
  ]);

  return {
    program_enrollments: programs.rows[0]?.c || 0,
    venture_memberships: ventures.rows[0]?.c || 0,
    timeline_events: timeline.rows[0]?.c || 0,
  };
}

/** Fold the duplicate into the survivor; returns `{ summary, counts }`. */
export async function mergeContacts({ survivorCid, duplicateCid, actorCid }) {
  const counts = { programs: 0, ventures: 0, timeline: 0, flags: 0 };

  // Reassign participant_programs
  const programsResult = await reassignContactPrograms(survivorCid, duplicateCid);
  counts.programs = programsResult.rowsAffected || 0;

  // Reassign venture_members
  const venturesResult = await reassignContactVentures(survivorCid, duplicateCid);
  counts.ventures = venturesResult.rowsAffected || 0;

  // Phase 6: the survivor inherits the duplicate's venture relationships —
  // reconcile their context grants so a merged founder keeps working access.
  try {
    await syncContextGrantsForUser(survivorCid);
  } catch (_) {}

  // Move timeline events
  const timelineResult = await reassignContactTimelineEvents(survivorCid, duplicateCid);
  counts.timeline = timelineResult.rowsAffected || 0;

  // Write merge event to timeline
  await createContactMergeTimelineEvent(survivorCid, duplicateCid, actorCid, counts);

  // Soft-delete the duplicate and free its email (unique placeholder) so the
  // address can be reused by a new contact later without tripping the
  // contacts_email_key unique constraint.
  await softDeleteDuplicateContact(actorCid, duplicateCid);

  // Mark duplicate flags as resolved
  const flagsResult = await resolveDuplicateFlagsForMerge(survivorCid, duplicateCid, actorCid);
  counts.flags = flagsResult.rowsAffected || 0;

  const summary = `${counts.programs} programs, ${counts.ventures} ventures, ${counts.timeline} events reassigned`;
  return { summary, counts };
}
