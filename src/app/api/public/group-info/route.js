import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * PUBLIC endpoint — no auth required.
 * GET /api/public/group-info?id=X
 * Returns group name + program_id + registration window for registration page.
 */
export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    let group = null;

    // Try families table first (by id OR registration_id)
    const result = await db.execute({
      sql: "SELECT CAST(id AS TEXT) as id, name, program_id FROM families WHERE CAST(id AS TEXT) = ? OR registration_id = ?",
      args: [id, id],
    });

    if (result.rows.length > 0) {
      group = result.rows[0];
    }

    // Try v2_groups
    if (!group) {
      const v2result = await db.execute({
        sql: "SELECT CAST(id AS TEXT) as id, name, program_id FROM v2_groups WHERE CAST(id AS TEXT) = ?",
        args: [id],
      });
      if (v2result.rows.length > 0) {
        group = v2result.rows[0];
      }
    }

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Fetch program registration window if program_id exists
    let registration_window = null;
    if (group.program_id) {
      const progResult = await db.execute({
        sql: "SELECT registration_window FROM v2_programs WHERE CAST(id AS TEXT) = ?",
        args: [String(group.program_id)],
      });
      if (progResult.rows.length > 0) {
        registration_window = progResult.rows[0].registration_window;
      }
    }

    return NextResponse.json({ group: { ...group, registration_window } });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
