// =============================================================================
// KPI PROGRESS API (Persistent)
// Reads KPI progress from the kpi_progress table.
// Falls back to dynamic calculation if no persisted data exists.
// =============================================================================
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getKpiProgress } from "@/services/dashboard/kpiProgress";

export const dynamic = "force-dynamic";

/**
 * GET /api/kpi-progress?program_id=xxx
 * Returns persisted KPI progress for a program.
 *
 * The read (persisted row, schema-drift fallback, on-the-fly recalculation and
 * the overall average) lives in `services/dashboard/kpiProgress`.
 */
export const GET = createHandler(
  { roles: ["staff", "super_admin", "program_manager"] },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const { status, body } = await getKpiProgress(searchParams.get("program_id"));
    return NextResponse.json(body, { status });
  },
);
