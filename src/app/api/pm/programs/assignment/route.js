import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(req) {
  try {
    await initDb();
    const { program_id, contact_cid, type } = await req.json();

    if (!program_id || !contact_cid) {
      return NextResponse.json({ success: false, error: "Program and Contact required." }, { status: 400 });
    }

    // type can be 'pm' or 'assistant'
    const column = type === 'pm' ? 'assigned_pm_id' : 'assigned_assistant_id';

    await db.execute({
      sql: `UPDATE v2_programs SET ${column} = ? WHERE id = ?`,
      args: [contact_cid, program_id]
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
