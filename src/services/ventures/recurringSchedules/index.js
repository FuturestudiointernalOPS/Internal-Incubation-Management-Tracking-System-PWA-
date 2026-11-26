/**
 * VENTURE RECURRING MEETING SCHEDULES — P1 service.
 *
 * P1 is planning only. Nothing here creates a session, sends a notice, touches a
 * calendar or modifies an existing record. The one write is a schedule row.
 *
 * `previewSchedule` is pure in effect: it validates and calculates, and returns
 * what WOULD happen. The UI's Preview button calls it, which is how a pattern is
 * agreed before P2 ever materialises anything.
 */

import {
  closeScheduleRow,
  insertScheduleRow,
  selectScheduleById,
  selectScheduleExceptions,
  selectSchedulesByVenture,
  setScheduleStatusRow,
} from "@/models/ventureSessionSchedulesStore";
import { resolveVentureInternalId } from "@/models/ventureIdentityStore";
import { ensureVentureSchema } from "../schema";
import { addDays, buildOccurrences } from "./occurrences";
import { validateScheduleInput } from "./validate";

const today = () => new Date().toISOString().slice(0, 10);

const shape = (row) =>
  row
    ? {
        id: row.id,
        ventureId: row.venture_id,
        title: row.title,
        description: row.description,
        sessionType: row.session_type,
        timezone: row.timezone,
        frequency: row.frequency,
        intervalCount: row.interval_count,
        slots: Array.isArray(row.slots) ? row.slots : [],
        validFrom: String(row.valid_from).slice(0, 10),
        validUntil: row.valid_until ? String(row.valid_until).slice(0, 10) : null,
        maxOccurrences: row.max_occurrences,
        status: row.status,
        staffCid: row.staff_cid,
        staffName: row.staff_name,
        milestoneRef: row.milestone_ref,
        version: row.version,
        supersedesId: row.supersedes_id,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;

/** The form shape the validator consumes, from a stored row. */
const toInput = (schedule) => ({
  title: schedule.title,
  description: schedule.description,
  session_type: schedule.sessionType,
  timezone: schedule.timezone,
  frequency: schedule.frequency,
  interval_count: schedule.intervalCount,
  slots: schedule.slots,
  valid_from: schedule.validFrom,
  valid_until: schedule.validUntil,
  max_occurrences: schedule.maxOccurrences,
  milestone_ref: schedule.milestoneRef,
  staff_cid: schedule.staffCid,
  staff_name: schedule.staffName,
});

/**
 * What the rule would produce, between two dates. WRITES NOTHING.
 */
export function previewSchedule(input = {}, { from = null, to = null, limit = 12, exceptions = [] } = {}) {
  const { errors, schedule } = validateScheduleInput(input);
  if (errors.length > 0) return { errors };

  // A preview needs a horizon. 90 days is far enough to see a monthly pattern
  // three times, and short enough to read.
  const windowFrom = from || (schedule.valid_from > today() ? schedule.valid_from : today());
  const windowTo = to || addDays(windowFrom, 90);

  return {
    errors: [],
    schedule,
    window: { from: windowFrom, to: windowTo },
    occurrences: buildOccurrences(schedule, { from: windowFrom, to: windowTo, limit, exceptions }),
  };
}

/** Whether the row belongs to the venture the caller is acting on. */
async function ownsSchedule(ventureRef, scheduleId) {
  const result = await selectScheduleById(scheduleId).catch(() => ({ rows: [] }));
  const row = (result.rows || [])[0];
  if (!row) return { row: null, reason: "venture.schedule.error.notFound" };

  const resolved = await resolveVentureInternalId(ventureRef).catch(() => ventureRef);
  const matches = String(row.venture_id) === String(resolved) || String(row.venture_id) === String(ventureRef);
  return matches ? { row, reason: null } : { row: null, reason: "venture.schedule.error.notFound" };
}

/** Create a schedule. Always starts as `draft`: nothing is live until P2. */
export async function createSchedule({ ventureRef, input = {}, actorCid = null }) {
  await ensureVentureSchema();
  const { errors, schedule } = validateScheduleInput(input);
  if (errors.length > 0) return { errors };

  const ventureId = await resolveVentureInternalId(ventureRef);
  const result = await insertScheduleRow({ ventureId, schedule, status: "draft", actorCid });
  return { schedule: shape((result.rows || [])[0]) };
}

/** Pause or resume a live schedule. Ending is separate and irreversible. */
export async function setScheduleStatus({ ventureRef, scheduleId, action }) {
  await ensureVentureSchema();
  const { row, reason } = await ownsSchedule(ventureRef, scheduleId);
  if (!row) return { errors: [reason] };
  if (row.status === "ended") return { errors: ["venture.schedule.error.ended"] };

  const next = action === "pause" ? "paused" : action === "resume" ? "active" : null;
  if (!next) return { errors: ["venture.schedule.error.action"] };

  const result = await setScheduleStatusRow(scheduleId, next);
  return { schedule: shape((result.rows || [])[0]) };
}

/**
 * End a schedule on a date. The rows stay: an ended schedule is history, and the
 * sessions it produced keep pointing at it.
 */
export async function endSchedule({ ventureRef, scheduleId, validUntil = null }) {
  await ensureVentureSchema();
  const { row, reason } = await ownsSchedule(ventureRef, scheduleId);
  if (!row) return { errors: [reason] };
  if (validUntil && validUntil < String(row.valid_from).slice(0, 10)) {
    return { errors: ["venture.schedule.error.validUntilBefore"] };
  }

  const result = await closeScheduleRow(scheduleId, validUntil || today());
  return { schedule: shape((result.rows || [])[0]) };
}

/**
 * Replace a schedule from a chosen date: the previous version is ENDED the day
 * before, and a new version is created pointing back at it.
 *
 * This is how "modify future occurrences" preserves history: the old rule keeps
 * its dates, its version and any sessions it produced.
 */
export async function createScheduleVersion({ ventureRef, scheduleId, input = {}, actorCid = null }) {
  await ensureVentureSchema();
  const { row, reason } = await ownsSchedule(ventureRef, scheduleId);
  if (!row) return { errors: [reason] };
  if (row.status === "ended") return { errors: ["venture.schedule.error.ended"] };

  const { errors, schedule } = validateScheduleInput(input);
  if (errors.length > 0) return { errors };

  const previousFrom = String(row.valid_from).slice(0, 10);
  if (schedule.valid_from <= previousFrom) {
    // The replacement must start after the version it replaces, otherwise the
    // two would claim the same days and history would double up.
    return { errors: ["venture.schedule.error.versionFrom"] };
  }

  await closeScheduleRow(scheduleId, addDays(schedule.valid_from, -1));
  const result = await insertScheduleRow({
    ventureId: row.venture_id,
    schedule,
    status: "draft",
    version: Number(row.version || 1) + 1,
    supersedesId: row.id,
    actorCid,
  });

  return { schedule: shape((result.rows || [])[0]) };
}

/**
 * Every schedule of a Venture with, for the live ones, the next few occurrences
 * and any exceptions already recorded.
 */
export async function listSchedules({ ventureRef, previewLimit = 3 } = {}) {
  await ensureVentureSchema();
  const result = await selectSchedulesByVenture(ventureRef);
  const rows = result.rows || [];

  const schedules = [];
  for (const row of rows) {
    const schedule = shape(row);
    const live = schedule.status !== "ended";
    let next = [];
    if (live) {
      const exceptions = (await selectScheduleExceptions(schedule.id).catch(() => ({ rows: [] }))).rows || [];
      next = buildOccurrences(toInput(schedule), {
        from: today(),
        to: addDays(today(), 90),
        limit: previewLimit,
        exceptions,
      });
    }
    schedules.push({ ...schedule, next });
  }

  return { schedules };
}
