import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const GET = createHandler(
  { roles: ["staff", "super_admin", "program_manager", "teacher", "team"] },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const teamId = searchParams.get("team_id");

    let sql = "SELECT * FROM v2_followups WHERE 1=1";
    const args = [];

    if (programId) {
      sql += " AND program_id = ?";
      args.push(programId);
    }
    if (teamId) {
      sql += " AND team_id = ?";
      args.push(teamId);
    }

    sql += " ORDER BY created_at DESC";

    const result = await db.execute({ sql, args });
    return NextResponse.json({ success: true, followups: result.rows });
  },
);

export const POST = createHandler(
  { roles: ["staff", "super_admin", "program_manager", "teacher"] },
  async (req) => {
    const {
      program_id,
      team_id,
      week_number,
      session_id,
      submission_id,
      scheduled_at,
      comment,
      followup_type,
    } = await req.json();

    const result = await db.execute({
      sql: `INSERT INTO v2_followups (program_id, team_id, week_number, session_id, submission_id, scheduled_at, comment, followup_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      args: [
        program_id,
        team_id || null,
        week_number || null,
        session_id || null,
        submission_id || null,
        scheduled_at || null,
        comment || null,
        followup_type || "coaching",
      ],
    });
    return NextResponse.json({ success: true, followup: result.rows[0] });
  },
);
