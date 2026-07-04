import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";

export const GET = createHandler(
  { roles: ["staff", "super_admin"] },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const result = await db.execute({
      sql: "SELECT * FROM v2_followups WHERE program_id = ? ORDER BY created_at DESC",
      args: [programId],
    });
    return NextResponse.json({ success: true, followups: result.rows });
  },
);

export const POST = createHandler(
  { roles: ["staff", "super_admin"] },
  async (req) => {
    const { program_id, week_number, session_id, comment } = await req.json();
    const result = await db.execute({
      sql: "INSERT INTO v2_followups (program_id, week_number, session_id, comment) VALUES (?, ?, ?, ?) RETURNING *",
      args: [program_id, week_number, session_id || null, comment],
    });
    return NextResponse.json({ success: true, followup: result.rows[0] });
  },
);
