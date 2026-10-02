import {
  reassignContactPrograms,
  reassignContactVentures,
  reassignContactTimelineEvents,
  createContactMergeTimelineEvent,
  softDeleteDuplicateContact,
  resolveDuplicateFlagsForMerge,
} from "@/models/contacts";

/**
 * Merge a duplicate contact into a survivor. Auth gates stay in the controller.
 *
 * @returns {{ status: number, body: object }}
 */
export async function mergeContacts({ survivorCid, duplicateCid, actorCid }) {
  if (!survivorCid || !duplicateCid) {
    return {
      status: 400,
      body: { success: false, error: "survivor_cid and duplicate_cid required" },
    };
  }

  const counts = { programs: 0, ventures: 0, timeline: 0, flags: 0 };

  const programsResult = await reassignContactPrograms(survivorCid, duplicateCid);
  counts.programs = programsResult.rowsAffected || 0;

  const venturesResult = await reassignContactVentures(survivorCid, duplicateCid);
  counts.ventures = venturesResult.rowsAffected || 0;

  try {
    const { syncContextGrantsForUser } = await import(
      "@/models/authorization/contextGrants"
    );
    await syncContextGrantsForUser(survivorCid);
  } catch (_) {}

  const timelineResult = await reassignContactTimelineEvents(
    survivorCid,
    duplicateCid,
  );
  counts.timeline = timelineResult.rowsAffected || 0;

  await createContactMergeTimelineEvent(
    survivorCid,
    duplicateCid,
    actorCid,
    counts,
  );

  await softDeleteDuplicateContact(actorCid, duplicateCid);

  const flagsResult = await resolveDuplicateFlagsForMerge(
    survivorCid,
    duplicateCid,
    actorCid,
  );
  counts.flags = flagsResult.rowsAffected || 0;

  const summary = `${counts.programs} programs, ${counts.ventures} ventures, ${counts.timeline} events reassigned`;
  return { status: 200, body: { success: true, summary, counts } };
}
