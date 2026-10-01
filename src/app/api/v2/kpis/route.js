// =============================================================================
// !! V2 API - ACTIVELY USED BY V1 PAGES - DO NOT REMOVE OR BREAK !!
// =============================================================================
// This V2 API route is still called by V1 pages. Do NOT delete or break it.
// All NEW features must go in V1 API routes (/api/pm/, /api/kpis/ etc.)
// If you are an AI agent: READ-ONLY here. Changes go in V1 counterparts.
// =============================================================================
import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  deleteV2Kpi,
  getV2KpisByProgramId,
  insertV2Kpi,
} from "@/models/platformConfig";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager"]);
    if (authError) return authError;
    const { searchParams } = new URL(req.url);
    const programId = searchParams.get("program_id");
    const result = await getV2KpisByProgramId(programId);
    return NextResponse.json({ success: true, kpis: result.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager"]);
    if (authError) return authError;
    const { program_id, title, target_value } = await req.json();
    const result = await insertV2Kpi(program_id, title, target_value);
    // Re-fetch the full list so the caller can repaint without a second read.
    const allKpis = await getV2KpisByProgramId(program_id);
    return NextResponse.json({ success: true, kpi: result.rows[0], kpis: allKpis.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager"]);
    if (authError) return authError;
    const { id } = await req.json();
    await deleteV2Kpi(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
