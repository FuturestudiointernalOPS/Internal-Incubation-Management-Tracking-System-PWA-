// =============================================================================
// KPI PROGRESS RECALCULATE API
// Recalculates and persists KPI progress for a given program.
// Called whenever a session or document requirement changes status.
// =============================================================================
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { recalculateKpiProgress } from "@/lib/kpi-progress";
import { initDb } from "@/lib/db";

/**
 * POST /api/kpi-progress/recalculate
 * Body: { program_id: string }
 * Recalculates and stores KPI progress for a program.
 */
export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;

    const { program_id } = await req.json();
    if (!program_id) {
      return NextResponse.json(
        { success: false, error: "program_id is required" },
        { status: 400 },
      );
    }

    const entries = await recalculateKpiProgress(program_id);

    // Calculate overall operational progress
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
  } catch (error) {
    console.error("KPI Recalculate Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
