import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession, enforceFacilitatorProgramAccess, getFacilitatorParticipantScope } from "@/lib/auth";
import { recalculateKpiProgress } from "@/lib/kpi-progress";

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
    // Only "present" and "absent" are real decisions. A participant left on
    // "Select" (empty status) means no decision yet and must NOT be stored.
    const valid = records.filter((r) => r.session_id && r.participant_id && r.status);

    // Server-side enforcement: facilitators must be assigned to the program
    // and hold attendance.record at level >= 1.
    const session = await getSession();
    if (session?.role === "facilitator") {
      const progId = records[0]?.program_id || null;
      if (!progId) {
        return NextResponse.json(
          { success: false, error: "errors.insufficientPermissions" },
          { status: 403 },
        );
      }
      const facError = await enforceFacilitatorProgramAccess(
        progId,
        "attendance.record",
        1,
      );
      if (facError) return facError;
    }

    if (records.length === 0) {
      return NextResponse.json({ success: true, upserted: 0 });
    }

    const sessionId = records[0].session_id;
    const date = records[0].date || new Date().toISOString().split("T")[0];

    // 1. Delete ALL existing records for this session+date so participants
    //    left on "Select" (no status) are cleared rather than keeping a stale
    //    previous mark. This runs even when no participant has a decision yet.
    await db.execute({
      sql: `DELETE FROM v2_attendance WHERE session_id = ? AND date = ?`,
      args: [sessionId, date],
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

    // Facilitator scope: assigned-groups facilitators only see attendance for
    // participants in their groups.
    let facGroupFilter = null;
    let facGroupArgs = [];
    if (session?.role === "facilitator" && programId) {
      const facError = await enforceFacilitatorProgramAccess(
        programId,
        "attendance.view",
        1,
      );
      if (facError) return facError;
      const scope = await getFacilitatorParticipantScope(programId, session.cid);
      if (scope.scope === "groups") {
        if (scope.groupNames.length === 0) {
          return NextResponse.json({ success: true, attendance: [] });
        }
        facGroupFilter =
          "a.participant_id IN (SELECT p.user_id::text FROM v2_participants p JOIN contacts c ON p.email = c.email WHERE UPPER(TRIM(c.group_name)) IN (" +
          scope.groupNames.map(() => "?").join(",") +
          "))";
        facGroupArgs = scope.groupNames.map((n) => n.toUpperCase());
      }
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");
    const programId = searchParams.get("program_id");
    const participantId = searchParams.get("participant_id");
    const summary = searchParams.get("summary") === "true";

    // ── Summary mode: return attendance rates per participant ──
    if (summary && programId) {
      const summaryRes = await db.execute({
        sql: `
          SELECT
            a.participant_id,
            p.name as participant_name,
            COUNT(*) as total_sessions,
            SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
            SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
            SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) as excused_count,
            SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_count,
            ROUND(
              (SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END)::decimal / NULLIF(COUNT(*), 0)) * 100
            , 1) as attendance_rate
          FROM v2_attendance a
          LEFT JOIN v2_participants p ON a.participant_id::text = p.user_id::text
          WHERE a.program_id = ? AND ${facGroupFilter ? facGroupFilter.replace(/^a\./, "") : "1=1"}
          GROUP BY a.participant_id, p.name
          ORDER BY attendance_rate DESC
        `,
        args: [programId],
      });

      return NextResponse.json({
        success: true,
        summary: summaryRes.rows,
      });
    }

    let sql = "SELECT a.*, p.name as participant_name FROM v2_attendance a LEFT JOIN v2_participants p ON a.participant_id::text = p.user_id::text WHERE 1=1";
    const args = [];

    if (sessionId) {
      sql += " AND a.session_id = ?";
      args.push(sessionId);
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
