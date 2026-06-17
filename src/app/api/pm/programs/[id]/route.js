import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;

    const result = await db.execute({
      sql: `SELECT p.*,
                   c1.name as pm_name,
                   c2.name as assistant_name,
                   k.title as note_title
            FROM v2_programs p
            LEFT JOIN contacts c1 ON p.assigned_pm_id = c1.cid
            LEFT JOIN contacts c2 ON p.assigned_assistant_id = c2.cid
            LEFT JOIN v2_knowledge_bank k ON p.note_id = CAST(k.id AS TEXT)
            WHERE p.id = ?`,
      args: [id],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Program not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, program: result.rows[0] });
  } catch (error) {
    console.error("GET Program Detail Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
