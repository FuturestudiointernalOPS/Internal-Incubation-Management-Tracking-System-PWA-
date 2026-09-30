import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { recalculateKpiProgress } from "@/lib/kpi-progress";

export const POST = createHandler(
  { roles: ["staff", "super_admin", "program_manager"] },
  async (req) => {
    const { program_id } = await req.json();
    if (!program_id)
      return NextResponse.json(
        { success: false, error: "program_id is required" },
        { status: 400 },
      );
    const entries = await recalculateKpiProgress(program_id);
    // Objectives weigh the same: the programme figure is their plain average.
    // Non-measurable objectives (no linked deliverable) are left out.
    const measurableEntries = entries.filter((entry) => entry.measurable !== false);
    const overallProgress =
      measurableEntries.length > 0
        ? Math.round(
            measurableEntries.reduce(
              (sum, entry) => sum + (parseFloat(entry.completion_rate) || 0),
              0,
            ) / measurableEntries.length,
          )
        : 0;
    return NextResponse.json({
      success: true,
      kpiProgress: entries,
      overallProgress,
    });
  },
);
