/**
 * Investor service — the relationship meetings.
 *
 * Layer (see docs/LAYER_SPLIT.md): the DECISIONS live here — the own-scope
 * binding of a workspace's meetings to the caller's investor profile, the
 * meeting creation with its scheduled timeline entry, and the completion cascade
 * (the completed timeline entry plus the workspace `next_action` seeded from the
 * first action item). Every statement lives in `@/models/investorRelations`. No
 * SQL, no HTTP: a refusal is a value ({ ok: false, status, error }) the HTTP
 * boundary turns into a response.
 */

import {
  getVentureIdByWorkspaceId,
  getVentureNameForCompletedMeeting,
  getVentureNameForScheduledMeeting,
  getWorkspaceForMeetingCompletion,
  insertMeetingCompletedTimeline,
  insertMeetingScheduledTimeline,
  insertRelationshipMeeting,
  listMeetingsForWorkspace,
  setWorkspaceNextAction,
  updateRelationshipMeeting,
} from "@/models/investorRelations";
import {
  resolveInvestorScope,
  investorOwnsWorkspace,
} from "@/models/authorization/investorScope";

/**
 * The meetings of a workspace. The workspace id comes from the request, so a
 * non-management caller is bound to their own workspace before its meetings are
 * returned; a workspace that is not the caller's own is a 404.
 */
export async function listMeetingsForViewer({ workspaceId, session }) {
  if (!workspaceId) return { ok: false, status: 400, error: "workspace_id required" };

  const scope = await resolveInvestorScope(session);
  if (!scope.management && !(await investorOwnsWorkspace(workspaceId, scope.profileId))) {
    return { ok: false, status: 404, error: "errors.notFound" };
  }

  const result = await listMeetingsForWorkspace(workspaceId);
  return { ok: true, meetings: result.rows };
}

/** Create a meeting and log the scheduling on the workspace timeline. */
export async function createRelationshipMeeting({
  workspaceId,
  meetingType,
  scheduledDate,
  scheduledTime,
  durationMinutes,
  location,
  notes,
  session,
}) {
  if (!workspaceId) return { ok: false, status: 400, error: "workspace_id required" };

  const result = await insertRelationshipMeeting(
    workspaceId,
    meetingType || "introductory",
    scheduledDate || null,
    scheduledTime || null,
    durationMinutes || 60,
    location || null,
    notes || null,
  );
  const meeting = result.rows[0];

  // Kept from the controller: the venture lookup is performed even though its
  // result is discarded, so the moved code stays byte-for-byte equivalent.
  const workspace = await getVentureIdByWorkspaceId(workspaceId);
  await getVentureNameForScheduledMeeting(workspace.rows[0]?.venture_id);

  await insertMeetingScheduledTimeline(
    workspaceId,
    `${meetingType.replace(/_/g, " ")} meeting scheduled${scheduledDate ? " for " + scheduledDate : ""}`,
    session.cid || session.id,
  );

  return { ok: true, meeting };
}

/**
 * Update a meeting and, when it is marked COMPLETED, log the completion on the
 * workspace timeline and seed the workspace `next_action` from the first action
 * item.
 */
export async function updateRelationshipMeetingCascade({ id, fields, session }) {
  if (!id) return { ok: false, status: 400, error: "meeting id required" };

  const result = await updateRelationshipMeeting(id, fields);

  if (result.updated === false) return { ok: false, status: 400, error: "Nothing to update" };
  if (result.rows.length === 0) return { ok: false, status: 404, error: "Meeting not found" };

  const meeting = result.rows[0];

  if (fields.status === "completed") {
    const workspace = await getWorkspaceForMeetingCompletion(id);
    if (workspace.rows.length > 0) {
      const ventureName =
        (await getVentureNameForCompletedMeeting(workspace.rows[0].venture_id)).rows[0]?.name ||
        "Venture";

      await insertMeetingCompletedTimeline(
        workspace.rows[0].id,
        `Meeting completed${fields.outcome ? ": " + fields.outcome : ""} for ${ventureName}`,
        session.cid || session.id,
      );

      // Update workspace next_action if action_items provided.
      if (fields.action_items) {
        const items =
          typeof fields.action_items === "string"
            ? JSON.parse(fields.action_items)
            : fields.action_items;
        if (Array.isArray(items) && items.length > 0) {
          await setWorkspaceNextAction(items[0], workspace.rows[0].id);
        }
      }
    }
  }

  return { ok: true, meeting };
}
