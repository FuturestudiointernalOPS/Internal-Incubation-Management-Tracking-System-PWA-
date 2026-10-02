import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  requireAuth,
  getSession,
  requireAssignmentAccess,
  hasProgramManagementAccess,
} from "@/lib/auth";
import {
  defaultAttendanceDate,
  ensureAttendanceSchema,
  filterAllowedAttendanceRecords,
  findForeignAttendanceRecord,
  isAttendanceWithinTodayWindow,
  readAttendance,
  readAttendanceSummary,
  resolveAttendanceParticipantScope,
  resolveFacilitatorAttendanceFilter,
  writeAttendanceRecords,
} from "@/services/operations/attendance";

/**
 * ATTENDANCE API — controller layer.
 *
 * POST /api/attendance — record marks (facilitator program/team scope)
 * GET  /api/attendance — list or summarise marks (own-scope / facilitator scope)
 *
 * Auth, the assignment guard (which answers HTTP) and the envelope only; every
 * decision lives in `@/services/operations/attendance` (see docs/LAYER_SPLIT.md).
 */

export async function POST(req) {
  try {
    await initDb();
    // Phase I5: assignment is the security decision. The old role pre-filter
    // (staff/PM/facilitator) blocked members who legitimately hold a
    // program assignment — the assignment + attendance.record capability
    // check below authorizes them; everyone unassigned is denied there.
    const authError = await requireAuth();
    if (authError) return authError;

    await ensureAttendanceSchema();

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
      if (findForeignAttendanceRecord(records, programId)) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }

      const scope = await resolveAttendanceParticipantScope({
        programId,
        sessionCid: session.cid,
      });
      allowedParticipantIds = scope.allowedParticipantIds;
    }

    // Keep only records the caller is allowed to write. For facilitators this
    // silently drops any participant outside their assigned teams.
    const scoped = filterAllowedAttendanceRecords(records, allowedParticipantIds);

    if (scoped.length === 0) {
      return NextResponse.json({ success: true, upserted: 0 });
    }

    // ─── Attendance integrity: attendance can only be recorded for today ───
    // Super admins keep full control (corrections / backfill); all other roles
    // are locked to a ±1 day window that tolerates timezone differences.
    const todayStr = defaultAttendanceDate();
    const requestedDate = scoped[0].date || todayStr;
    if (
      session?.role !== "super_admin" &&
      !isAttendanceWithinTodayWindow(requestedDate)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Attendance can only be recorded for today's date.",
        },
        { status: 400 },
      );
    }

    const upserted = await writeAttendanceRecords({
      records: scoped,
      requestedDate,
    });

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
      const resolved = await resolveFacilitatorAttendanceFilter({
        programId,
        sessionCid: session.cid,
      });
      if (resolved?.empty) {
        return NextResponse.json({ success: true, attendance: [] });
      }
      if (resolved) {
        facilitatorGroupFilter = resolved.filter;
        facilitatorGroupArgs = resolved.args;
      }
    }

    // ── Summary mode: return attendance rates per participant ──
    if (summary && programId) {
      const summaryResult = await readAttendanceSummary(
        programId,
        facilitatorGroupFilter,
        facilitatorGroupArgs,
      );

      return NextResponse.json({
        success: true,
        summary: summaryResult.rows,
      });
    }

    const result = await readAttendance({
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
