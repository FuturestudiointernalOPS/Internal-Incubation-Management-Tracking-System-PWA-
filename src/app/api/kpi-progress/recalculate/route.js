import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { recalculateKpiProgress } from "@/lib/kpi-progress";

export const POST = createHandler(
  { roles: ["staff", "super_admin", "program_manager", "teacher"] },
  async (req) => {
    const { program_id } = await req.json();
    if (!program_id)
      return NextResponse.json(
        { success: false, error: "program_id is required" },
        { status: 400 },
      );
    const entries = await recalculateKpiProgress(program_id);
    const overallProgress =
      entries.length > 0
        ? Math.round(
            entries.reduce((sum, e) => sum + (e.progress || 0), 0) /
              entries.length,
          )
        : 0;
    return NextResponse.json({
      success: true,
      kpiProgress: entries,
      overallProgress,
    });
  },
);
