import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireAuthorization } from "@/lib/authorization";
import { v4 as uuidv4 } from "uuid";
import {
  createFacilitatorsGroupForNewProgram,
  createProgramFromTemplate,
  getProgramSourceById,
  getProgramTemplateById,
  listProgramTemplates,
  saveProgramAsTemplate,
} from "@/models/programs";

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

    const result = await listProgramTemplates();

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
    // Phase 2 (legacy cleanup): no staff compatibility bypass — templates
    // require the programs.create capability through the resolver.
    const capError = await requireAuthorization("programs", "create");
    if (capError) return capError;

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

      const src = await getProgramSourceById(program_id);
      if (src.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Program not found" },
          { status: 404 },
        );
      }
      const p = src.rows[0];

      const templateId = uuidv4();
      await saveProgramAsTemplate(templateId, template_name, p);

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

      const tmpl = await getProgramTemplateById(template_id);
      if (tmpl.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: "Template not found" },
          { status: 404 },
        );
      }
      const t = tmpl.rows[0];

      // Prevent start date in the past
      if (start_date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (new Date(start_date) < today) {
          return NextResponse.json(
            { success: false, error: "Start date cannot be in the past." },
            { status: 400 },
          );
        }
      }

      const newId = uuidv4();
      await createProgramFromTemplate(
        newId,
        name,
        start_date,
        end_date,
        assigned_pm_id,
        t,
      );

      // Auto-create the system-defined Facilitators group for this program
      try {
        await createFacilitatorsGroupForNewProgram(newId);
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
