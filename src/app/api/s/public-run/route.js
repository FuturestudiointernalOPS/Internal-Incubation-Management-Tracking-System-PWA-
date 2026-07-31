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
    const slug = searchParams.get("slug");
    
    let run;
    if (slug) {
      // Try slug lookup first, fall back if column doesn't exist
      try {
        run = await db.execute({
          sql: "SELECT r.id, r.name, r.description, r.status, r.closes_at, r.public_slug, r.form_id, f.name as form_name, f.description as form_description FROM platform_form_runs r JOIN platform_forms f ON r.form_id = f.id WHERE r.public_slug = ? AND r.status = 'active'",
          args: [slug],
        });
      } catch (_) {
        // public_slug column may not exist — fall back to ID lookup
        run = await db.execute({
          sql: "SELECT r.id, r.name, r.description, r.status, r.closes_at, r.form_id, f.name as form_name, f.description as form_description FROM platform_form_runs r JOIN platform_forms f ON r.form_id = f.id WHERE r.id = ? AND r.status = 'active'",
          args: [parseInt(slug) || 0],
        });
      }
    } else if (id) {
      run = await db.execute({
        sql: "SELECT r.id, r.name, r.description, r.status, r.closes_at, r.form_id, f.name as form_name, f.description as form_description FROM platform_form_runs r JOIN platform_forms f ON r.form_id = f.id WHERE r.id = ? AND r.status = 'active'",
        args: [parseInt(id)],
      });
    } else {
      return NextResponse.json({ success: false, error: "id or slug required" }, { status: 400 });
    }
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
    console.error("[Public Run] Error:", error.message);
    return NextResponse.json({ success: false, error: "An error occurred" }, { status: 500 });
  }
}
