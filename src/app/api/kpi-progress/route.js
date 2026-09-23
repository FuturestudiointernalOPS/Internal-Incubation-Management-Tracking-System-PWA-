// =============================================================================
// KPI PROGRESS API (Persistent)
// Reads KPI progress from the kpi_progress table.
// Falls back to dynamic calculation if no persisted data exists.
// =============================================================================
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { recalculateKpiProgress } from "@/lib/kpi-progress";
import { getKpiProgressByProgramId } from "@/models/platformConfig";

export const dynamic = "force-dynamic";

/**
 * GET /api/kpi-progress?program_id=xxx
 * Returns persisted KPI progress for a program.
 */
export const GET = createHandler(
  { roles: ['staff', 'super_admin', 'program_manager'] },
  async (req) => {
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");

    if (!programId) {
      return NextResponse.json(
        { success: false, error: "program_id is required" },
        { status: 400 },
      );
    }

    // Read from persisted kpi_progress table
    let progressEntries;
    try {
      const progressResult = await getKpiProgressByProgramId(programId);
      progressEntries = progressResult.rows || [];
    } catch {
      // kpi_progress schema mismatch, see SCHEMA_DRIFT_AUDIT.md cluster 11
      return NextResponse.json({
        success: true,
        kpiProgress: [],
        overallProgress: 0,
        source: "unavailable",
      });
    }

    // If no persisted data exists, calculate on the fly and persist it
    if (progressEntries.length === 0) {
      try {
        progressEntries = await recalculateKpiProgress(programId);
      } catch (error) {
        console.warn("KPI auto-recalculate failed, returning empty:", error);
      }
    }

    // Calculate overall operational progress
    const overallProgress =
      progressEntries.length > 0
        ? Math.round(
            progressEntries.reduce(
              (sum, entry) => sum + (parseFloat(entry.completion_rate) || 0),
              0,
            ) / progressEntries.length,
          )
        : 0;

    return NextResponse.json({
      success: true,
      kpiProgress: progressEntries,
      overallProgress,
      source: progressEntries.length > 0 ? "persisted" : "empty",
    });
  },
);
