import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * PUBLIC endpoint — no auth required.
 * GET /api/public/group-info?id=X
 * Returns group name + program_id for registration page.
 */
export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    // Try families table first
    const result = await db.execute({
      sql: "SELECT CAST(id AS TEXT) as id, name, program_id FROM families WHERE CAST(id AS TEXT) = ?",
      args: [id],
    });

    if (result.rows.length > 0) {
      return NextResponse.json({ group: result.rows[0] });
    }

    // Try v2_groups
    const v2result = await db.execute({
      sql: "SELECT CAST(id AS TEXT) as id, name, program_id FROM v2_groups WHERE CAST(id AS TEXT) = ?",
      args: [id],
    });

    if (v2result.rows.length > 0) {
      return NextResponse.json({ group: v2result.rows[0] });
    }

    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
