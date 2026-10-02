/**
 * VENTURE MENTORING SESSIONS & SCHEDULING.
 *
 * The session catalogue (list / read with its notes, attendance and action
 * items), the double-booking check, the create / update / cancel / reschedule /
 * delete flow (with the legacy-column fallbacks and the scheduling floor), the
 * notes, the attendance upsert and the action items.
 *
 * The decisions — the overlap rules, the create fallbacks, the scheduling floor,
 * the status side-effects and the action-item scope — live here; every statement
 * is in `@/models/ventureSessionsStore`. Nothing here runs SQL.
 *
 * This module used to be re-exported through `@/lib/ventures`; that barrel is
 * gone (CH-4) and importers read this module directly. See docs/LAYER_SPLIT.md.
 */

import {
  selectSessions,
  selectSessionById,
  selectSessionNotes,
  selectSessionAttendance,
  selectSessionActionItems,
  selectVentureSessionConflicts,
  selectCoachSessionConflicts,
  insertSessionFull,
  insertSessionWithoutMaterials,
  insertSessionWithoutDeliverable,
  insertSessionActivityCreated,
  insertSessionActivityCancelled,
  insertSessionActivityCompleted,
  insertSessionActivityRescheduled,
  updateSessionColumns,
  updateSessionWindow,
  deleteSessionRow,
  insertSessionNote,
  upsertSessionAttendance,
  insertActionItem,
  updateActionItemScoped,
} from "@/models/ventureSessionsStore";
import { isUnknownColumnError } from "@/lib/ventureInput";
import { SESSION_MIN_LEAD_MINUTES } from "@/lib/ventureSessionRules";

export async function listSessions(ventureId, { startDate, endDate, status, coachId, limit } = {}) {
  const res = await selectSessions(ventureId, { startDate, endDate, status, coachId, limit });
  return res.rows || [];
}

export async function getSession(sessionId) {
  const [sRes, nRes, aRes, iRes] = await Promise.all([
    selectSessionById(sessionId),
    selectSessionNotes(sessionId),
    selectSessionAttendance(sessionId),
    selectSessionActionItems(sessionId),
  ]);
  if (sRes.rows.length === 0) return null;
  return { ...sRes.rows[0], notes: nRes.rows || [], attendance: aRes.rows || [], action_items: iRes.rows || [] };
}

export async function checkDoubleBooking({ ventureId, coachId, startTime, endTime, excludeSessionId }) {
  const vRes = await selectVentureSessionConflicts(ventureId, endTime, startTime, excludeSessionId);
  if (vRes.rows.length > 0) return { conflict: true, type: "venture", message: "Time slot conflicts with an existing session." };
  if (coachId) {
    const cRes = await selectCoachSessionConflicts(coachId, endTime, startTime);
    if (cRes.rows.length > 0) return { conflict: true, type: "coach", message: "Coach has a conflicting session." };
  }
  return { conflict: false };
}

export async function createSession({ ventureId, title, description, sessionType, coachId, coachName, founderCid, founderName, startTime, endTime, timezone, location, meetingLink, agenda, createdBy, ventureFacing = false, preparationNotes = null, journeyStageId = null, milestoneRef = null, taskId = null, coachContactId = null, deliverableId = null, materials = null }) {
  if (new Date(startTime) >= new Date(endTime)) throw new Error("End time must be after start time.");
  if (new Date(endTime) < new Date()) throw new Error("Cannot schedule sessions in the past.");
  const conflict = await checkDoubleBooking({ ventureId, coachId, startTime, endTime });
  if (conflict.conflict) throw new Error(conflict.message);
  const materialsJson = Array.isArray(materials) && materials.length > 0 ? JSON.stringify(materials) : null;
  const insertArgs = [ventureId, title.trim(), description||null, sessionType||"coaching", coachId||null, coachName||null, founderCid||null, founderName||null, startTime, endTime, timezone||"UTC", location||null, meetingLink||null, agenda||null, createdBy||"system", ventureFacing ? true : false, preparationNotes||null, journeyStageId||null, milestoneRef||null, taskId||null, coachContactId||null, deliverableId||null, materialsJson];
  let res;
  try {
    res = await insertSessionFull(insertArgs);
  } catch (error) {
    // Older database missing the newest columns: drop them one at a time, so a
    // database only one migration behind keeps its deliverable link.
    if (!isUnknownColumnError(error)) throw error;
    try {
      res = await insertSessionWithoutMaterials(insertArgs.slice(0, -1));
    } catch (retryError) {
      if (!isUnknownColumnError(retryError)) throw retryError;
      res = await insertSessionWithoutDeliverable(insertArgs.slice(0, -2));
    }
  }
  const id = res.rows[0]?.id || res.lastInsertRowid;
  await insertSessionActivityCreated(id, ventureId, createdBy||"system", JSON.stringify({ title, session_type: sessionType }));
  return { id };
}

export async function updateSession(sessionId, updates) {
  const allowed = ["title", "description", "session_type", "coach_id", "coach_name", "founder_cid", "founder_name", "start_time", "end_time", "timezone", "location", "meeting_link", "status", "agenda", "recording_url", "venture_facing", "preparation_notes", "journey_stage_id", "milestone_ref", "task_id", "coach_contact_id", "deliverable_id", "materials"];
  const sets = []; const args = [];
  // `materials` is a JSONB column: callers hand over an array, the column gets
  // the serialized form (null when the list is cleared).
  for (const column of allowed) {
    if (updates[column] === undefined) continue;
    sets.push(`${column} = ?`);
    args.push(column === "materials" ? (Array.isArray(updates[column]) && updates[column].length > 0 ? JSON.stringify(updates[column]) : null) : updates[column]);
  }
  if (sets.length === 0) return { updated: false };
  if (updates.start_time || updates.end_time) {
    const sessionResult = await selectSessionById(sessionId);
    if (sessionResult.rows.length > 0) {
      const bookingCheck = await checkDoubleBooking({ ventureId: sessionResult.rows[0].venture_id, coachId: sessionResult.rows[0].coach_id, startTime: updates.start_time||sessionResult.rows[0].start_time, endTime: updates.end_time||sessionResult.rows[0].end_time, excludeSessionId: sessionId });
      if (bookingCheck.conflict) throw new Error(bookingCheck.message);
    }
  }
  sets.push("updated_at = NOW()"); args.push(sessionId);
  await updateSessionColumns(sets, args);
  if (updates.status === "cancelled") await insertSessionActivityCancelled(sessionId, JSON.stringify({}));
  if (updates.status === "completed") await insertSessionActivityCompleted(sessionId, JSON.stringify({}));
  return { updated: true };
}

export async function cancelSession(sessionId) {
  await updateSession(sessionId, { status: "cancelled" });
  return { success: true };
}

export async function rescheduleSession(sessionId, newStartTime, newEndTime) {
  const sessionResult = await selectSessionById(sessionId);
  if (sessionResult.rows.length === 0) throw new Error("Session not found.");
  // Vinance 3: the same scheduling floor that guards booking also guards a
  // reschedule — a parseable window, an end after the start, and a start at
  // least SESSION_MIN_LEAD_MINUTES ahead.
  const startAt = new Date(newStartTime);
  const endAt = new Date(newEndTime);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new Error("A session date and time are required.");
  }
  if (startAt >= endAt) throw new Error("End time must be after start time.");
  if (startAt.getTime() < Date.now() + SESSION_MIN_LEAD_MINUTES * 60 * 1000) {
    throw new Error(`A session must start at least ${SESSION_MIN_LEAD_MINUTES} minutes from now.`);
  }
  const bookingCheck = await checkDoubleBooking({ ventureId: sessionResult.rows[0].venture_id, coachId: sessionResult.rows[0].coach_id, startTime: newStartTime, endTime: newEndTime, excludeSessionId: sessionId });
  if (bookingCheck.conflict) throw new Error(bookingCheck.message);
  await updateSessionWindow(sessionId, newStartTime, newEndTime);
  await insertSessionActivityRescheduled(sessionId, JSON.stringify({ new_start: newStartTime, new_end: newEndTime }));
  return { success: true };
}

export async function deleteSession(sessionId) {
  await deleteSessionRow(sessionId);
  return { success: true };
}

export async function addSessionNote({ sessionId, noteType, content, authorCid, authorName, attachments }) {
  const res = await insertSessionNote(sessionId, noteType||"shared", content, authorCid||null, authorName||null, JSON.stringify(attachments||[]));
  return { id: res.rows[0]?.id || res.lastInsertRowid };
}

export async function recordAttendance({ sessionId, participantCid, participantName, participantType, status }) {
  await upsertSessionAttendance(sessionId, participantCid, participantName||null, participantType||null, status||"attended");
  return { success: true };
}

export async function createActionItem({ sessionId, title, description, ownerCid, ownerName, priority, dueDate }) {
  const res = await insertActionItem(sessionId, title.trim(), description||null, ownerCid||null, ownerName||null, priority||"medium", dueDate||null);
  return { id: res.rows[0]?.id || res.lastInsertRowid };
}

export async function updateActionItem(itemId, updates, ventureIds = []) {
  const allowed = ["title", "description", "owner_cid", "owner_name", "priority", "due_date", "status", "completed_at"];
  const sets = []; const args = [];
  for (const column of allowed) { if (updates[column] !== undefined) { sets.push(`${column} = ?`); args.push(updates[column]); } }
  if (sets.length === 0) return { updated: false };
  sets.push("updated_at = NOW()"); args.push(itemId);
  const ids = (Array.isArray(ventureIds) ? ventureIds : [ventureIds]).filter(
    (ventureId) => ventureId !== null && ventureId !== undefined,
  );
  if (ids.length === 0) return { updated: false };
  // Scoped through the action item's session: an item of another venture's
  // session matches no row.
  const scope = ids.map(() => "venture_id = ?").join(" OR ");
  await updateActionItemScoped(sets, args, scope, ids);
  return { updated: true };
}
