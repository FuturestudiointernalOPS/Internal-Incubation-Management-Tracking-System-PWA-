/**
 * Internal operations — ATTENDANCE (SERVICE layer).
 *
 * The domain work behind `/api/attendance`. What lives here:
 *
 *   - the idempotent schema steps that make the table usable before a
 *     migration has run;
 *   - the WRITE plan: a facilitator may only write participants in the teams
 *     they handle (an empty scope writes nothing), every row in a batch must
 *     belong to the authorized program, and non-managers are locked to a ±1
 *     day window around today;
 *   - the mark upsert (an empty status clears the row, otherwise delete then
 *     insert so a save stays idempotent);
 *   - the READ scope: the facilitator's team filter (deny-closed when they have
 *     none) and the summary/list reads.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions and orchestration, no SQL, no HTTP.
 * It reads and writes through `@/models/**`. The controller keeps `requireAuth`,
 * the assignment guard (which answers HTTP) and the envelope.
 */

import {
  addAttendanceDateColumn,
  addAttendanceProgramIdColumn,
  addAttendanceUpdatedAtColumn,
  createAttendanceTable,
  createAttendanceUniqueIndex,
  dedupeLegacyAttendanceRows,
  deleteAttendanceMark,
  getAttendanceSummary,
  getContactsInTeams,
  insertAttendanceMark,
  listAttendance,
} from "@/models/facilitation";
import { getFacilitatorTeamScope } from "@/models/authorization/accessQueries";
import { getLocalToday } from "@/lib/constants";

/**
 * Ensure the table and its columns exist, then enforce one mark per
 * participant/session/day. Every step is idempotent and best-effort: a failure
 * must not stop a save that the live schema already supports.
 */
export async function ensureAttendanceSchema() {
  try {
    // The production table uses an INTEGER SERIAL primary key (see
    // scripts/migrations/migrate_attendance.mjs). The INSERT omits id.
    await createAttendanceTable();
    // Add columns that may not exist on older versions of the table
    await addAttendanceProgramIdColumn();
    await addAttendanceDateColumn();
    await addAttendanceUpdatedAtColumn();
    // Dedupe legacy duplicate rows (same session+date+participant), keeping the
    // most recently updated one, then enforce uniqueness so attendance saves
    // stay idempotent: one mark per participant per session per day.
    await dedupeLegacyAttendanceRows();
    await createAttendanceUniqueIndex();
  } catch (_) {}
}

/**
 * The participants a facilitator may write in a program: none when they handle
 * no team, their teams' contacts otherwise, and `null` (unrestricted) when the
 * scope is the whole program.
 *
 * @returns {Promise<{allowedParticipantIds: Set<string>|null}>}
 */
export async function resolveAttendanceParticipantScope({ programId, sessionCid }) {
  const scope = await getFacilitatorTeamScope(programId, sessionCid);
  if (scope.scope === "none") {
    return { allowedParticipantIds: new Set() };
  }
  if (scope.scope === "teams" && scope.teamIds.length > 0) {
    const inScopeResult = await getContactsInTeams(scope.teamIds);
    return {
      allowedParticipantIds: new Set(inScopeResult.rows.map((row) => row.cid)),
    };
  }
  return { allowedParticipantIds: null };
}

/**
 * A batch is authorized from its FIRST record's program, but each record inserts
 * its OWN `program_id`. Any record naming a different program would write
 * outside the scope that was just checked, so such a batch is refused.
 */
export function findForeignAttendanceRecord(records, programId) {
  return records.find(
    (record) =>
      record?.program_id && String(record.program_id) !== String(programId),
  );
}

/**
 * Keep only records the caller is allowed to write. For facilitators this
 * silently drops any participant outside their assigned teams.
 */
export function filterAllowedAttendanceRecords(records, allowedParticipantIds) {
  if (!allowedParticipantIds) return records;
  return records.filter(
    (record) =>
      record.participant_id &&
      allowedParticipantIds.has(String(record.participant_id)),
  );
}

/**
 * Attendance can only be recorded for today. A ±1 day window tolerates
 * client/server timezone differences while still blocking far-past/future dates.
 * Super admins keep full control (corrections / backfill) — the route exempts
 * them before consulting this.
 */
export function isAttendanceWithinTodayWindow(dateStr) {
  const now = new Date();
  const allowedDates = new Set();
  for (let i = -1; i <= 1; i++) {
    const candidateDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + i,
    );
    allowedDates.add(
      `${candidateDate.getFullYear()}-${String(candidateDate.getMonth() + 1).padStart(2, "0")}-${String(candidateDate.getDate()).padStart(2, "0")}`,
    );
  }
  return allowedDates.has(dateStr);
}

/**
 * Apply each record individually: a save only ever touches the participants it
 * explicitly lists, so marks recorded for other participants are never deleted
 * or rewritten.
 *   - empty status   → delete that participant's mark (explicit clear)
 *   - present/absent → delete then re-insert (idempotent upsert)
 *
 * @returns {Promise<number>} how many marks were written
 */
export async function writeAttendanceRecords({ records, requestedDate }) {
  let upserted = 0;
  for (const record of records) {
    if (!record.session_id || !record.participant_id) continue;
    const recordDate = record.date || requestedDate;
    await deleteAttendanceMark(
      record.session_id,
      recordDate,
      record.participant_id,
    );
    if (record.status) {
      await insertAttendanceMark({
        session_id: record.session_id,
        program_id: record.program_id,
        participant_id: record.participant_id,
        status: record.status,
        date: recordDate,
      });
      upserted++;
    }
  }
  return upserted;
}

/**
 * The facilitator read filter: `null` when the scope is the whole program,
 * `{ empty: true }` when they handle no team (nothing to show), otherwise the
 * `participant_id IN (…)` fragment and its args.
 *
 * @returns {Promise<null | {empty: true} | {filter: string, args: string[]}>}
 */
export async function resolveFacilitatorAttendanceFilter({ programId, sessionCid }) {
  const scope = await getFacilitatorTeamScope(programId, sessionCid);
  if (scope.scope === "all") return null;
  if (scope.teamIds.length === 0) return { empty: true };
  return {
    filter:
      "participant_id IN (SELECT c.cid FROM contacts c WHERE c.v2_team_id IN (" +
      scope.teamIds.map(() => "?").join(",") +
      "))",
    args: scope.teamIds,
  };
}

/** The today string used as the default requested date on a write. */
export function defaultAttendanceDate() {
  return getLocalToday();
}

/** Attendance rates per participant for a program. */
export async function readAttendanceSummary(programId, groupFilter, groupArgs) {
  return getAttendanceSummary(programId, groupFilter, groupArgs);
}

/** The raw attendance rows for a program/session/participant/date read. */
export async function readAttendance(filters) {
  return listAttendance(filters);
}
