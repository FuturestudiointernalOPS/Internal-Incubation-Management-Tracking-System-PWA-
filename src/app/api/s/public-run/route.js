import { NextResponse } from "next/server";
import db, { initDb } from "@/lib/db";

/**
 * GET /api/s/public-run?slug=X
 * Public endpoint — returns run + form + sections + fields.
 * No authentication required. Slug-only lookup (numeric IDs never accepted).
 */
export async function GET(req) {
  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return NextResponse.json({ success: false, error: "slug required" }, { status: 400 });
    }

    // Slug-only lookup — prevents sequential-ID probing of active runs.
    let run;
    try {
      run = await db.execute({
        sql: "SELECT r.id, r.name, r.description, r.status, r.closes_at, r.public_slug, r.form_id, f.name as form_name, f.description as form_description FROM platform_form_runs r JOIN platform_forms f ON r.form_id = f.id WHERE r.public_slug = ? AND r.status = 'active'",
        args: [slug],
      });
    } catch (_) {
      // Legacy schemas without the public_slug column resolve as not-found.
      run = { rows: [] };
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

    // Fetch group name if this run is assigned to a group
    let groupName = null;
    try {
      const groupQuery = await db.execute({
        sql: "SELECT f.name FROM platform_form_run_assignments a JOIN families f ON (a.target_id = f.registration_id OR a.target_id = CAST(f.id AS TEXT)) WHERE a.run_id = ? AND a.target_type = 'group' LIMIT 1",
        args: [parseInt(run.rows[0].id)],
      });
      if (groupQuery.rows.length > 0) {
        groupName = groupQuery.rows[0].name;
      }
    } catch (_) {}

    const runData = { ...run.rows[0], group_name: groupName };

    return NextResponse.json({
      success: true,
      run: runData,
      sections: sections.rows,
      fields: fields.rows,
    });
  } catch (error) {
    console.error("[Public Run] Error:", error.message);
    return NextResponse.json({ success: false, error: "An error occurred" }, { status: 500 });
  }
}
