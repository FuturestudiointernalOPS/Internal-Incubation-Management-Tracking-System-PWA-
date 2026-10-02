/**
 * Investor service — the investor meetings (the `api/investor/meetings`
 * surface, distinct from a relationship workspace's meetings).
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISION lives here — a self-service
 * caller must name a venture, because without that filter the query would
 * return every investor's meetings platform-wide. Every statement lives in
 * `@/models/investorRelations`. No SQL, no HTTP: a refusal is a value
 * ({ ok: false, status, error }) the HTTP boundary turns into a response.
 */

import {
  insertInvestorMeeting,
  listInvestorMeetingEvents,
} from "@/models/investorRelations";
import { resolveInvestorScope } from "@/models/authorization/investorScope";

/**
 * The investor meetings of a venture. Without a venture filter the query
 * returns EVERY investor's meetings, so a non-management caller must supply
 * one; management keeps the historical unfiltered read.
 */
export async function listInvestorMeetingsForViewer({ ventureId, session }) {
  const scope = await resolveInvestorScope(session);
  if (!scope.management && !ventureId) {
    return { ok: false, status: 400, error: "venture_id required" };
  }

  const result = await listInvestorMeetingEvents({ ventureId });
  return { ok: true, meetings: result.rows };
}

/** Schedule an investor meeting (a title and a start time are required). */
export async function createInvestorMeeting({
  ventureId,
  title,
  description,
  startTime,
  endTime,
  location,
  session,
}) {
  if (!title || !startTime) {
    return { ok: false, status: 400, error: "Title and start_time required" };
  }

  const result = await insertInvestorMeeting(
    ventureId || null,
    title,
    description || null,
    startTime,
    endTime || null,
    location || "video",
    session.cid || session.id,
  );

  return { ok: true, meeting: result.rows[0] };
}
