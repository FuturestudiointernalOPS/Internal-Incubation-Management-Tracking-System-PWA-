import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";

/**
 * GET /api/s/public-run?id=X
 * Public endpoint — returns run + form + sections + fields.
 * No authentication required.
 */
export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 });

    const run = await db.execute({
      sql: "SELECT r.*, f.name as form_name, f.description as form_description FROM platform_form_runs r JOIN platform_forms f ON r.form_id = f.id WHERE r.id = ? AND r.status = 'active'",
      args: [parseInt(id)],
    });
    if (run.rows.length === 0) return NextResponse.json({ success: false, error: "Run not found or not active" }, { status: 404 });

    const sections = await db.execute({
      sql: "SELECT * FROM platform_form_sections WHERE form_id = ? ORDER BY sort_order",
      args: [run.rows[0].form_id],
    });

    const fields = await db.execute({
      sql: "SELECT * FROM platform_form_fields WHERE form_id = ? ORDER BY sort_order",
      args: [run.rows[0].form_id],
    });

    return NextResponse.json({
      success: true,
      run: run.rows[0],
      sections: sections.rows,
      fields: fields.rows,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
