import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

/**
 * GET  /api/pm/programs/templates — List all templates
 * POST /api/pm/programs/templates?action=save   — Save program as template
 * POST /api/pm/programs/templates?action=apply  — Create program from template
 */

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;

    const result = await db.execute({
      sql: "SELECT id, name, description, program_type, duration_weeks, created_at FROM v2_programs WHERE is_template = 1 ORDER BY name ASC",
      args: [],
    });

    return NextResponse.json({ success: true, templates: result.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["staff", "super_admin"]);
    if (authError) return authError;

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "save") {
      const { program_id, template_name } = await req.json();
      if (!program_id || !template_name) {
        return NextResponse.json(
          { success: false, error: "program_id and template_name required" },
          { status: 400 },
        );
      }

      const src = await db.execute({
        sql: "SELECT * FROM v2_programs WHERE id = ?",
        args: [program_id],
      });
      if (src.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Program not found" },
          { status: 404 },
        );
      }
      const p = src.rows[0];

      const templateId = uuidv4();
      await db.execute({
        sql: `INSERT INTO v2_programs
          (id, name, description, concept_note, vision, objectives, program_type, visibility,
           participant_limit, registration_window, language, duration_weeks, grading_mode,
           feedback_enabled, materials, is_template, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'template')`,
        args: [
          templateId,
          template_name,
          p.description,
          p.concept_note,
          p.vision,
          p.objectives,
          p.program_type || "incubation",
          p.visibility || "private",
          p.participant_limit || 0,
          p.registration_window,
          p.language || "en",
          p.duration_weeks || 4,
          p.grading_mode || "graded",
          p.feedback_enabled != null ? p.feedback_enabled : 1,
          p.materials,
        ],
      });

      return NextResponse.json({ success: true, template_id: templateId });
    }

    if (action === "apply") {
      const { template_id, name, start_date, end_date, assigned_pm_id } =
        await req.json();
      if (!template_id || !name) {
        return NextResponse.json(
          { success: false, error: "template_id and name required" },
          { status: 400 },
        );
      }

      const tmpl = await db.execute({
        sql: "SELECT * FROM v2_programs WHERE id = ? AND is_template = 1",
        args: [template_id],
      });
      if (tmpl.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Template not found" },
          { status: 404 },
        );
      }
      const t = tmpl.rows[0];

      const newId = uuidv4();
      await db.execute({
        sql: `INSERT INTO v2_programs
          (id, name, description, concept_note, vision, objectives, program_type, visibility,
           participant_limit, registration_window, language, duration_weeks, grading_mode,
           feedback_enabled, materials, start_date, end_date, assigned_pm_id, status, template_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Planned', ?)`,
        args: [
          newId,
          name,
          t.description,
          t.concept_note,
          t.vision,
          t.objectives,
          t.program_type || "incubation",
          t.visibility || "private",
          t.participant_limit || 0,
          t.registration_window,
          t.language || "en",
          t.duration_weeks || 4,
          t.grading_mode || "graded",
          t.feedback_enabled != null ? t.feedback_enabled : 1,
          t.materials,
          start_date || null,
          end_date || null,
          assigned_pm_id || null,
          t.id,
        ],
      });

      // Auto-create the system-defined Facilitators group for this program
      try {
        await db.execute({
          sql: `INSERT INTO v2_groups (program_id, name, type, is_system)
                SELECT ?, 'Facilitators', 'facilitators', 1
                WHERE NOT EXISTS (
                  SELECT 1 FROM v2_groups WHERE program_id = ? AND UPPER(TRIM(name)) = 'FACILITATORS'
                )`,
          args: [newId, newId],
        });
      } catch (_) {}

      return NextResponse.json({ success: true, id: newId });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Templates error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
