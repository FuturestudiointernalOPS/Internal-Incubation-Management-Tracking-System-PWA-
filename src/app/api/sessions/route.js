import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSession, enforceFacilitatorProgramAccess } from "@/lib/auth";

export const POST = createHandler({ roles: ["staff", "super_admin", "program_manager", "teacher", "facilitator"] }, async (req) => {
  const body = await req.json();
  const { program_id, title, week_number, type, teacher_id, start_at } = body;

  if (!program_id || !title) {
    return NextResponse.json(
      { success: false, error: "Missing required fields" },
      { status: 400 },
    );
  }

  // Server-side enforcement: facilitators must be assigned and hold sessions.conduct
  const session = await getSession();
  if (session?.role === "facilitator") {
    const facError = await enforceFacilitatorProgramAccess(
      program_id,
      "sessions.conduct",
      1,
    );
    if (facError) return facError;
  }

  const res = await db.execute({
    sql: `INSERT INTO v2_sessions (program_id, title, week_number, type, teacher_id, start_at)
          VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      program_id,
      title,
      week_number || 1,
      type || "Masterclass",
      teacher_id || null,
      start_at || null,
    ],
  });

  return NextResponse.json({
    success: true,
    session: {
      id: Number(res.rows[0]?.id ?? res.lastInsertRowid),
      program_id,
      title,
      week_number,
      type,
      teacher_id,
    },
  });
});

export const GET = createHandler({ roles: ["staff", "super_admin", "program_manager", "teacher", "facilitator"] }, async (req) => {
  const { searchParams } = new URL(req.url);
  const program_id = searchParams.get("program_id");

  // Server-side enforcement for facilitators
  if (program_id) {
    const session = await getSession();
    if (session?.role === "facilitator") {
      const facError = await enforceFacilitatorProgramAccess(
        program_id,
        "sessions.conduct",
        1,
      );
      if (facError) return facError;
    }
  }

  let sql = "SELECT * FROM v2_sessions";
  let args = [];

  if (program_id) {
    sql += " WHERE program_id = ?";
    args.push(program_id);
  }

  sql += " ORDER BY week_number ASC";

  const { rows } = await db.execute({ sql, args });
  return NextResponse.json({ success: true, sessions: rows });
});
