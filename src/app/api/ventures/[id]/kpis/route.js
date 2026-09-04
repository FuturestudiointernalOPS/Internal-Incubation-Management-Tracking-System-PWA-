import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireVentureAccess } from "@/lib/ventureAuth";

const ROLES = ["participant", "founder", "staff", "program_manager", "super_admin", "teacher", "developer"];
const ALLOWED = ["participant", "founder", "staff", "program_manager", "super_admin", "teacher"];

async function resolveVentureDbId(ventureId) {
  const r = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
  return r.rows?.[0]?.id || null;
}

// Live auto-calc for the sources we actually have data for. Anything else
// falls back to the manually-entered current_value — don't over-build.
async function autoCalc(dbId, source) {
  if (source === "customer_interviews") {
    const r = await db.execute({ sql: "SELECT COUNT(*) as c FROM venture_customer_interviews WHERE venture_id = ?", args: [dbId] });
    return parseInt(r.rows?.[0]?.c || 0);
  }
  if (source === "milestones") {
    const r = await db.execute({ sql: "SELECT AVG(progress) as avg_progress FROM venture_milestones WHERE venture_id = ?", args: [dbId] });
    return Math.round(parseFloat(r.rows?.[0]?.avg_progress || 0));
  }
  if (source === "tasks") {
    const r = await db.execute({ sql: "SELECT COUNT(*) as c FROM venture_tasks WHERE venture_id = ? AND status = 'done'", args: [dbId] });
    return parseInt(r.rows?.[0]?.c || 0);
  }
  return null;
}

export async function GET(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;
    const { id } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const r = await db.execute({
      sql: `SELECT a.id, a.venture_id, a.kpi_definition_id, a.target_value, a.current_value, a.updated_at,
                   d.name, d.description, d.unit, d.auto_calc_source
            FROM venture_kpi_assignments a
            JOIN venture_kpi_definitions d ON d.id = a.kpi_definition_id
            WHERE a.venture_id = ?
            ORDER BY d.name`,
      args: [dbId],
    });

    const kpis = [];
    for (const row of r.rows || []) {
      let currentValue = row.current_value;
      if (row.auto_calc_source) {
        const computed = await autoCalc(dbId, row.auto_calc_source);
        if (computed !== null) {
          currentValue = computed;
          await db.execute({ sql: "UPDATE venture_kpi_assignments SET current_value = ?, updated_at = NOW() WHERE id = ?", args: [computed, row.id] });
        }
      }
      kpis.push({ ...row, current_value: currentValue });
    }

    return NextResponse.json({ success: true, kpis });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ALLOWED);
    if (authError) return authError;
    const { id } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const { kpi_definition_id, target_value } = await req.json();
    if (!kpi_definition_id) return NextResponse.json({ success: false, error: "kpi_definition_id required" }, { status: 400 });

    try {
      await db.execute({ sql: "INSERT INTO venture_kpi_assignments (venture_id, kpi_definition_id, target_value) VALUES (?,?,?)", args: [dbId, kpi_definition_id, target_value ?? null] });
    } catch (e) {
      if (e.message?.includes("UNIQUE") || e.message?.includes("duplicate")) {
        return NextResponse.json({ success: false, error: "KPI already assigned to this venture" }, { status: 409 });
      }
      throw e;
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    await initDb();
    const authError = await requireAuth(ALLOWED);
    if (authError) return authError;
    const { id } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const { id: assignmentId, current_value } = await req.json();
    if (!assignmentId || current_value === undefined) {
      return NextResponse.json({ success: false, error: "id and current_value required" }, { status: 400 });
    }

    // Manual update only allowed when the assigned KPI has no auto_calc_source.
    const check = await db.execute({
      sql: `SELECT d.auto_calc_source FROM venture_kpi_assignments a
            JOIN venture_kpi_definitions d ON d.id = a.kpi_definition_id
            WHERE a.id = ? AND a.venture_id = ?`,
      args: [assignmentId, dbId],
    });
    if (!check.rows?.length) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (check.rows[0].auto_calc_source) {
      return NextResponse.json({ success: false, error: "This KPI is auto-calculated and cannot be edited manually." }, { status: 400 });
    }

    await db.execute({ sql: "UPDATE venture_kpi_assignments SET current_value = ?, updated_at = NOW() WHERE id = ? AND venture_id = ?", args: [current_value, assignmentId, dbId] });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
