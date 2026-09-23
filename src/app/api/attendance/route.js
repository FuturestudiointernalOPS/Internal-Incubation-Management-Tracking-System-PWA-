import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, requireAssignmentAccess, getFacilitatorTeamScope, hasProgramManagementAccess } from "@/lib/auth";
import { getLocalToday } from "@/lib/constants";
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

export async function POST(req) {
  try {
    await initDb();
    // Phase I5: assignment is the security decision. The old role pre-filter
    // (staff/PM/facilitator) blocked members who legitimately hold a
    // program assignment — the assignment + attendance.record capability
    // check below authorizes them; everyone unassigned is denied there.
    const authError = await requireAuth();
    if (authError) return authError;

    // Ensure table and columns exist (idempotent). The production table uses
    // an INTEGER SERIAL primary key (see scripts/migrations/migrate_attendance.mjs).
    // The INSERT below omits id so the database auto-generates it.
    try {
      await createAttendanceTable();
      // Add columns that may not exist on older versions of the table
      await addAttendanceProgramIdColumn();
      await addAttendanceDateColumn();
      await addAttendanceUpdatedAtColumn();
      // Dedupe legacy duplicate rows (same session+date+participant), keeping
      // the most recently updated one, then enforce uniqueness so attendance
      // saves stay idempotent: one mark per participant per session per day.
      await dedupeLegacyAttendanceRows();
      await createAttendanceUniqueIndex();
    } catch (_) {}

    const body = await req.json();
    const records = Array.isArray(body) ? body : [body];

    const session = await getSession();

    // Server-side enforcement: facilitators must be assigned to the program,
    // hold attendance.record, and may only write participants in their teams.
    let allowedParticipantIds = null; // null = no restriction
    if (session && !hasProgramManagementAccess(session.role)) {
      const programId = records[0]?.program_id || null;
      if (!programId) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
      const facError = await requireAssignmentAccess({
        resource: "program",
        contextId: programId,
        capability: "attendance.record",
        minLevel: 1,
      });
      if (facError) return facError;

      // The gate above is decided from the FIRST record's program, but each
      // record inserts its OWN program_id. A batch whose first row names the
      // assigned program could therefore carry later rows for a different
      // program, writing attendance outside the scope that was just checked.
      // Every row must belong to the program that was authorized.
      const foreignRecord = records.find(
        (record) =>
          record?.program_id && String(record.program_id) !== String(programId),
      );
      if (foreignRecord) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }

      const scope = await getFacilitatorTeamScope(programId, session.cid);
      if (scope.scope === "none") {
        allowedParticipantIds = new Set();
      } else if (scope.scope === "teams" && scope.teamIds.length > 0) {
        const inScopeResult = await getContactsInTeams(scope.teamIds);
        allowedParticipantIds = new Set(inScopeResult.rows.map((row) => row.cid));
      }
    }

    // Keep only records the caller is allowed to write. For facilitators this
    // silently drops any participant outside their assigned teams.
    const scoped = allowedParticipantIds
      ? records.filter(
          (record) =>
            record.participant_id &&
            allowedParticipantIds.has(String(record.participant_id)),
        )
      : records;

    if (scoped.length === 0) {
      return NextResponse.json({ success: true, upserted: 0 });
    }

    // ─── Attendance integrity: attendance can only be recorded for today ───
    // Super admins keep full control (corrections / backfill); all other
    // roles are locked to today. A ±1 day window tolerates client/server
    // timezone differences while still blocking far-past/future dates.
    const todayStr = getLocalToday();
    const requestedDate = scoped[0].date || todayStr;
    const withinTodayWindow = (() => {
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
      return allowedDates.has(requestedDate);
    })();
    if (session?.role !== "super_admin" && !withinTodayWindow) {
      return NextResponse.json(
        {
          success: false,
          error: "Attendance can only be recorded for today's date.",
        },
        { status: 400 },
      );
    }

    // Apply each record individually: a save only ever touches the
    // participants it explicitly lists (facilitators are additionally
    // restricted to their team by the scope filter above), so marks recorded
    // for other participants — e.g. by the PM for another team — are never
    // deleted or rewritten.
    //   - empty status   → delete that participant's mark (explicit clear)
    //   - present/absent → delete then re-insert (idempotent upsert)
    let upserted = 0;
    for (const record of scoped) {
      if (!record.session_id || !record.participant_id) continue;
      const recordDate = record.date || requestedDate;
      await deleteAttendanceMark(record.session_id, recordDate, record.participant_id);
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

    return NextResponse.json({ success: true, upserted });
  } catch (error) {
    console.error("Attendance error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    // Phase I6B: any authenticated session may reach the scoping below —
    // program context → assignment (attendance.view) + team scope;
    // no program context → own rows only (own-scope fallback below).
    const authError = await requireAuth();
    if (authError) return authError;

    const session = await getSession();

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");
    const programId = searchParams.get("program_id");
    let participantId = searchParams.get("participant_id");
    const summary = searchParams.get("summary") === "true";
    const dateStr = searchParams.get("date");

    // Own-scope (Phase I6B): without a program context, non-management,
    // non-staff sessions (participants, members, …) may only read their own
    // attendance rows — participant_id is bound server-side, never
    // caller-chosen.
    if (
      session &&
      !programId &&
      !hasProgramManagementAccess(session.role) &&
      session.role !== "staff"
    ) {
      participantId = session.cid;
    }

    // Facilitator scope: facilitators only see attendance for participants in
    // the v2_teams where they are the handler.
    let facilitatorGroupFilter = null;
    let facilitatorGroupArgs = [];
    if (session && programId && !hasProgramManagementAccess(session.role)) {
      const facError = await requireAssignmentAccess({
        resource: "program",
        contextId: programId,
        capability: "attendance.view",
        minLevel: 1,
      });
      if (facError) return facError;
      const scope = await getFacilitatorTeamScope(programId, session.cid);
      if (scope.scope !== "all") {
        if (scope.teamIds.length === 0) {
          return NextResponse.json({ success: true, attendance: [] });
        }
        facilitatorGroupFilter =
          "participant_id IN (SELECT c.cid FROM contacts c WHERE c.v2_team_id IN (" +
          scope.teamIds.map(() => "?").join(",") +
          "))";
        facilitatorGroupArgs = scope.teamIds;
      }
    }

    // ── Summary mode: return attendance rates per participant ──
    if (summary && programId) {
      const summaryResult = await getAttendanceSummary(
        programId,
        facilitatorGroupFilter,
        facilitatorGroupArgs,
      );

      return NextResponse.json({
        success: true,
        summary: summaryResult.rows,
      });
    }

    const result = await listAttendance({
      sessionId,
      dateStr,
      programId,
      participantId,
      facGroupFilter: facilitatorGroupFilter,
      facGroupArgs: facilitatorGroupArgs,
    });
    return NextResponse.json({ success: true, attendance: result.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
