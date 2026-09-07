import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, requireAssignmentAccess, getFacilitatorTeamScope, hasProgramManagementAccess } from "@/lib/auth";
import { recalculateKpiProgress } from "@/lib/kpi-progress";
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
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
      "facilitator",
    ]);
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
      const progId = records[0]?.program_id || null;
      if (!progId) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
      const facError = await requireAssignmentAccess({
        resource: "program",
        contextId: progId,
        capability: "attendance.record",
        minLevel: 1,
      });
      if (facError) return facError;

      const scope = await getFacilitatorTeamScope(progId, session.cid);
      if (scope.scope === "none") {
        allowedParticipantIds = new Set();
      } else if (scope.scope === "teams" && scope.teamIds.length > 0) {
        const inScope = await getContactsInTeams(scope.teamIds);
        allowedParticipantIds = new Set(inScope.rows.map((r) => r.cid));
      }
    }

    // Keep only records the caller is allowed to write. For facilitators this
    // silently drops any participant outside their assigned teams.
    const scoped = allowedParticipantIds
      ? records.filter(
          (r) => r.participant_id && allowedParticipantIds.has(String(r.participant_id)),
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
      const base = new Date();
      const ok = new Set();
      for (let i = -1; i <= 1; i++) {
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
        ok.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      }
      return ok.has(requestedDate);
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
    for (const r of scoped) {
      if (!r.session_id || !r.participant_id) continue;
      const recordDate = r.date || requestedDate;
      await deleteAttendanceMark(r.session_id, recordDate, r.participant_id);
      if (r.status) {
        await insertAttendanceMark({
          session_id: r.session_id,
          program_id: r.program_id,
          participant_id: r.participant_id,
          status: r.status,
          date: recordDate,
        });
        upserted++;
      }
    }

    return NextResponse.json({ success: true, upserted });
  } catch (e) {
    console.error("Attendance error:", e);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
      "participant",
      "facilitator",
    ]);
    if (authError) return authError;

    const session = await getSession();

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");
    const programId = searchParams.get("program_id");
    const participantId = searchParams.get("participant_id");
    const summary = searchParams.get("summary") === "true";
    const dateStr = searchParams.get("date");

    // Facilitator scope: facilitators only see attendance for participants in
    // the v2_teams where they are the handler.
    let facGroupFilter = null;
    let facGroupArgs = [];
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
        facGroupFilter =
          "participant_id IN (SELECT c.cid FROM contacts c WHERE c.v2_team_id IN (" +
          scope.teamIds.map(() => "?").join(",") +
          "))";
        facGroupArgs = scope.teamIds;
      }
    }

    // ── Summary mode: return attendance rates per participant ──
    if (summary && programId) {
      const summaryRes = await getAttendanceSummary(programId, facGroupFilter, facGroupArgs);

      return NextResponse.json({
        success: true,
        summary: summaryRes.rows,
      });
    }

    const result = await listAttendance({
      sessionId,
      dateStr,
      programId,
      participantId,
      facGroupFilter,
      facGroupArgs,
    });
    return NextResponse.json({ success: true, attendance: result.rows });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}
