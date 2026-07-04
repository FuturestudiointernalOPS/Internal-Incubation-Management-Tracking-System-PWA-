// =============================================================================
// KPI PROGRESS API (Persistent)
// Reads KPI progress from the kpi_progress table.
// Falls back to dynamic calculation if no persisted data exists.
// =============================================================================
import db from "@/lib/db";
import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { recalculateKpiProgress } from "@/lib/kpi-progress";

export const dynamic = "force-dynamic";

/**
 * GET /api/kpi-progress?program_id=xxx
 * Returns persisted KPI progress for a program.
 */
export const GET = createHandler(
  { roles: ['staff', 'super_admin', 'program_manager', 'teacher'] },
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
      const progressRes = await db.execute({
        sql: "SELECT * FROM kpi_progress WHERE program_id = ? ORDER BY kpi_id ASC",
        args: [programId],
      });
      progressEntries = progressRes.rows || [];
    } catch (e) {
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
      } catch (e) {
        console.warn("KPI auto-recalculate failed, returning empty:", e);
      }
    }

    // Calculate overall operational progress
    const overallProgress =
      progressEntries.length > 0
        ? Math.round(
            progressEntries.reduce(
              (sum, e) => sum + (parseFloat(e.progress) || 0),
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
