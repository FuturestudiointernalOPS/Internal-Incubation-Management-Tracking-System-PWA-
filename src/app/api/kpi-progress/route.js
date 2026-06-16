// =============================================================================
// KPI PROGRESS API (Persistent)
// Reads KPI progress from the kpi_progress table.
// Falls back to dynamic calculation if no persisted data exists.
// =============================================================================
import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { recalculateKpiProgress } from "@/lib/kpi-progress";

export const dynamic = "force-dynamic";

/**
 * GET /api/kpi-progress?program_id=xxx
 * Returns persisted KPI progress for a program.
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth([
      "staff",
      "super_admin",
      "program_manager",
      "teacher",
    ]);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");

    if (!programId) {
      return NextResponse.json(
        { success: false, error: "program_id is required" },
        { status: 400 },
      );
    }

    // Read from persisted kpi_progress table
    const progressRes = await db.execute({
      sql: "SELECT * FROM kpi_progress WHERE program_id = ? ORDER BY kpi_id ASC",
      args: [programId],
    });

    let progressEntries = progressRes.rows || [];

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
  } catch (error) {
    console.error("KPI Progress Fetch Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
