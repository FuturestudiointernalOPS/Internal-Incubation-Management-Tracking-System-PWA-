import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { recalculateAndSummarize } from "@/services/dashboard/kpiProgress";

/**
 * POST /api/kpi-progress/recalculate
 *
 * Recalculates a programme's objective progress and returns the summary. The
 * recalculation and the measurable-only average live in
 * `services/dashboard/kpiProgress`.
 */
export const POST = createHandler(
  { roles: ["staff", "super_admin", "program_manager"] },
  async (req) => {
    const { program_id } = await req.json();
    const { status, body } = await recalculateAndSummarize(program_id);
    return NextResponse.json(body, { status });
  },
);
