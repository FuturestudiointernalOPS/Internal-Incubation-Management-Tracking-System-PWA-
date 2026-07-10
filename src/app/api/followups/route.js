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
  { roles: ["staff", "super_admin", "program_manager"] },
  async (req) => {
    let { program_id, week_number, session_id, comment, venture_id } = await req.json();
    // Venture-scoped follow-ups: reuse this same route/table (business rule —
    // "every Follow-up remains part of the Venture Timeline") rather than a
    // second meeting engine. Derive program_id from the venture if not passed.
    if (venture_id && !program_id) {
      const venture = await db.execute({ sql: "SELECT program_id FROM ventures WHERE id = ?", args: [venture_id] });
      if (!venture.rows?.length) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });
      program_id = venture.rows[0].program_id;
    }
    if (!program_id) {
      return NextResponse.json({ success: false, error: "This venture has no linked program yet — cannot schedule a follow-up." }, { status: 400 });
    }
    const result = await db.execute({
      sql: "INSERT INTO v2_followups (program_id, week_number, session_id, comment, venture_id) VALUES (?, ?, ?, ?, ?) RETURNING *",
      args: [program_id, week_number, session_id || null, comment, venture_id || null],
    });
    return NextResponse.json({ success: true, followup: result.rows[0] });
  },
);
