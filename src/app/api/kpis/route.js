import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth/guards";
import { getSession } from "@/server/auth/session";
import { requireProgramScope } from "@/lib/programScopedAccess";
import { logAuditEvent } from "@/services/tasks/auditLog";
import {
  createKpiDefinition,
  deleteKpiDefinition,
  resolveKpiProgramId,
  updateKpiDefinition,
} from "@/services/dashboard/kpis";
export const dynamic = "force-dynamic";

/**
 * KPIs API — STRATEGIC KPI MANAGEMENT
 * CRUD for program key performance indicators.
 *
 * The use-cases (owning-program lookup, the write, the default target) live in
 * `services/dashboard/kpis`. This controller authenticates, validates, applies
 * the program-scope gate, writes the audit entry and shapes the response.
 */

const ROLES = ["super_admin", "staff", "program_manager"];

const badRequest = (error) =>
  NextResponse.json({ success: false, error }, { status: 400 });

const serverError = (label, error) => {
  console.error(label, error);
  return NextResponse.json(
    { success: false, error: error.message },
    { status: 500 }
  );
};

/** The audit entry every KPI write leaves behind. */
async function audit(action, entityId, details) {
  const session = await getSession();
  await logAuditEvent({
    entity_type: "kpi",
    entity_id: entityId,
    user_id: session.user?.id,
    user_name: session.user?.name,
    action,
    details,
  });
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;

    const { program_id, title, target_value } = await req.json();
    if (!program_id || !title) return badRequest("program_id and title required");

    // Program scope (wave: groups) — targets belong to the cohorts wave.
    const scopeError = await requireProgramScope({ programId: program_id, wave: "groups" });
    if (scopeError) return scopeError;

    const details = await createKpiDefinition({
      programId: program_id,
      title,
      targetValue: target_value,
    });
    await audit("create_kpi", program_id, details);

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("KPI POST error:", error);
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;

    const { id, title, target_value } = await req.json();
    if (!id || !title) return badRequest("id and title required");

    // Program scope (wave: groups) — the handler receives only a KPI id, so the
    // owning program is read first.
    const programId = await resolveKpiProgramId(id);
    const scopeError = await requireProgramScope({ programId, wave: "groups" });
    if (scopeError) return scopeError;

    const details = await updateKpiDefinition({ id, title, targetValue: target_value });
    await audit("update_kpi", String(id), details);

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("KPI PUT error:", error);
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth(ROLES);
    if (authError) return authError;

    const { id } = await req.json();
    if (!id) return badRequest("id required");

    // Program scope (wave: groups) — read the owning program before deleting.
    const programId = await resolveKpiProgramId(id);
    const scopeError = await requireProgramScope({ programId, wave: "groups" });
    if (scopeError) return scopeError;

    await deleteKpiDefinition(id);
    await audit("delete_kpi", String(id), { kpi_id: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverError("KPI DELETE error:", error);
  }
}
