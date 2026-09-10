import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireVentureScopedAccess } from "@/lib/ventureScopedAccess";
import {
  countKpiCustomerInterviews,
  countKpiDoneTasks,
  createKpiAssignment,
  getKpiAssignmentAutoCalcSource,
  getKpiAssignments,
  getKpiAverageMilestoneProgress,
  getKpisVentureId,
  updateKpiAutoCalcValue,
  updateKpiManualValue,
} from "@/models/ventureJourney";


async function resolveVentureDbId(ventureId) {
  const r = await getKpisVentureId(ventureId);
  return r.rows?.[0]?.id || null;
}

// Live auto-calc for the sources we actually have data for. Anything else
// falls back to the manually-entered current_value — don't over-build.
async function autoCalc(dbId, source) {
  if (source === "customer_interviews") {
    const r = await countKpiCustomerInterviews(dbId);
    return parseInt(r.rows?.[0]?.c || 0);
  }
  if (source === "milestones") {
    const r = await getKpiAverageMilestoneProgress(dbId);
    return Math.round(parseFloat(r.rows?.[0]?.avg_progress || 0));
  }
  if (source === "tasks") {
    const r = await countKpiDoneTasks(dbId);
    return parseInt(r.rows?.[0]?.c || 0);
  }
  return null;
}

export async function GET(req, { params }) {
  try {
    await initDb();
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "view" });
    if (access.error) return access.error;
    const { session } = access;
    const { id } = await params;
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const r = await getKpiAssignments(dbId);

    const kpis = [];
    for (const row of r.rows || []) {
      let currentValue = row.current_value;
      if (row.auto_calc_source) {
        const computed = await autoCalc(dbId, row.auto_calc_source);
        if (computed !== null) {
          currentValue = computed;
          await updateKpiAutoCalcValue(computed, row.id);
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
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
    if (access.error) return access.error;
    const { session } = access;
    const { id } = await params;
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const { kpi_definition_id, target_value } = await req.json();
    if (!kpi_definition_id) return NextResponse.json({ success: false, error: "kpi_definition_id required" }, { status: 400 });

    try {
      await createKpiAssignment(dbId, kpi_definition_id, target_value ?? null);
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
    const access = await requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" });
    if (access.error) return access.error;
    const { session } = access;
    const { id } = await params;
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    const dbId = await resolveVentureDbId(id);
    if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

    const { id: assignmentId, current_value } = await req.json();
    if (!assignmentId || current_value === undefined) {
      return NextResponse.json({ success: false, error: "id and current_value required" }, { status: 400 });
    }

    // Manual update only allowed when the assigned KPI has no auto_calc_source.
    const check = await getKpiAssignmentAutoCalcSource(assignmentId, dbId);
    if (!check.rows?.length) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
    if (check.rows[0].auto_calc_source) {
      return NextResponse.json({ success: false, error: "This KPI is auto-calculated and cannot be edited manually." }, { status: 400 });
    }

    await updateKpiManualValue(current_value, assignmentId, dbId);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
