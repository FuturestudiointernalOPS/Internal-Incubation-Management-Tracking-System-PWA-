import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, requireAssignmentAccess, getFacilitatorTeamScope, hasProgramManagementAccess } from "@/lib/auth";
import { recalculateKpiProgress } from "@/lib/kpi-progress";
import { getLocalToday } from "@/lib/constants";

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

    // Ensure table and columns exist (idempotent)
    try {
      await db.execute({
        sql: `CREATE TABLE IF NOT EXISTS v2_attendance (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          session_id TEXT NOT NULL,
          participant_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'neutral',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )`,
        args: [],
      });
      // Add columns that may not exist on older versions of the table
      await db.execute({ sql: "ALTER TABLE v2_attendance ADD COLUMN IF NOT EXISTS program_id TEXT", args: [] });
      await db.execute({ sql: "ALTER TABLE v2_attendance ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE", args: [] });
      await db.execute({ sql: "ALTER TABLE v2_attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()", args: [] });
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
        const inScope = await db.execute({
          sql: "SELECT cid FROM contacts WHERE v2_team_id IN (" + scope.teamIds.map(() => "?").join(",") + ")",
          args: scope.teamIds,
        });
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

    // Only "present" and "absent" are real decisions. A participant left on
    // "Select" (empty status) means no decision yet and must NOT be stored.
    const valid = scoped.filter((r) => r.session_id && r.participant_id && r.status);

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

    const sessionId = scoped[0].session_id;
    const date = requestedDate;
    const submittedIds = [...new Set(scoped.map((r) => r.participant_id).filter(Boolean))];
    const ph = submittedIds.map(() => "?").join(",");

    // 1. Delete existing records ONLY for the submitted participants so a
    //    facilitator saving their group never wipes another group's marks.
    await db.execute({
      sql: `DELETE FROM v2_attendance WHERE session_id = ? AND date = ? AND participant_id IN (${ph})`,
      args: [sessionId, date, ...submittedIds],
    });

    // 2. Batch insert only the records that have a real decision (present/absent).
    if (valid.length > 0) {
      const valueTuples = valid.map(() => "(gen_random_uuid(), ?, ?, ?, ?, ?)").join(", ");
      const insertArgs = [];
      for (const r of valid) {
        insertArgs.push(
          r.session_id,
          r.program_id || null,
          r.participant_id,
          r.status,
          date
        );
      }
      await db.execute({
        sql: `INSERT INTO v2_attendance (id, session_id, program_id, participant_id, status, date)
              VALUES ${valueTuples}`,
        args: insertArgs,
      });
    }

    return NextResponse.json({ success: true, upserted: valid.length });
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
      const summaryRes = await db.execute({
        sql: `
          SELECT
            a.participant_id,
            c.name as participant_name,
            COUNT(*) as total_sessions,
            SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
            SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
            SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused_count,
            SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
            ROUND(
              (SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::decimal / 
              NULLIF((SELECT COUNT(DISTINCT date) FROM v2_attendance WHERE program_id = a.program_id), 0)) * 100
            , 1) as attendance_rate
          FROM v2_attendance a
          LEFT JOIN contacts c ON a.participant_id::text = c.cid
          WHERE a.program_id = ? AND ${facGroupFilter ? facGroupFilter : "1=1"}
          GROUP BY a.participant_id, c.name, a.program_id
          ORDER BY attendance_rate DESC
        `,
        args: [programId, ...facGroupArgs],
      });

      return NextResponse.json({
        success: true,
        summary: summaryRes.rows,
      });
    }

    let sql = "SELECT a.*, c.name as participant_name FROM v2_attendance a LEFT JOIN contacts c ON a.participant_id::text = c.cid WHERE 1=1";
    const args = [];

    if (sessionId) {
      sql += " AND a.session_id = ?";
      args.push(sessionId);
    }
    if (dateStr) {
      sql += " AND a.date = ?";
      args.push(dateStr);
    }
    if (programId) {
      sql += " AND a.program_id = ?";
      args.push(programId);
    }
    if (participantId) {
      sql += " AND a.participant_id = ?";
      args.push(participantId);
    }
    if (facGroupFilter) {
      sql += " AND " + facGroupFilter;
      args.push(...facGroupArgs);
    }
    sql += " ORDER BY date DESC, created_at DESC";

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, attendance: result.rows });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}
