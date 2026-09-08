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
  getV2KpiIdsByProgramId,
  getV2KpiProgramId,
  getV2KpisAfterCreate,
  getV2KpisAfterWeightUpdate,
  getV2KpisByProgramId,
  insertV2KpiWithAutoWeight,
  updateV2KpiAutoWeight,
  updateV2KpiManualWeight,
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
    const result = await insertV2KpiWithAutoWeight(program_id, title, target_value);
    // After inserting, redistribute weights equally for the program
    await redistributeProgramWeights(program_id);
    // Re-fetch all KPIs
    const allKpis = await getV2KpisAfterCreate(program_id);
    return NextResponse.json({ success: true, kpi: result.rows[0], kpis: allKpis.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager"]);
    if (authError) return authError;
    const { program_id, mode, weights } = await req.json();

    if (mode === "manual" && Array.isArray(weights)) {
      // Validate total equals 100
      const total = weights.reduce((sum, w) => sum + parseFloat(w.weight || 0), 0);
      if (Math.abs(total - 100) > 0.01) {
        return NextResponse.json(
          { success: false, error: `Total weight must equal 100%. Current total: ${total.toFixed(2)}%` },
          { status: 400 },
        );
      }
      // Apply manual weights
      for (const w of weights) {
        await updateV2KpiManualWeight(parseFloat(parseFloat(w.weight).toFixed(2)), w.id);
      }
    } else if (mode === "auto") {
      await redistributeProgramWeights(program_id);
    }

    const allKpis = await getV2KpisAfterWeightUpdate(program_id);
    return NextResponse.json({ success: true, kpis: allKpis.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

async function redistributeProgramWeights(programId) {
  const kpis = await getV2KpiIdsByProgramId(programId);
  const count = kpis.rows.length;
  if (count === 0) return;
  const equal = parseFloat((100 / count).toFixed(2));
  let remaining = 100;
  for (let i = 0; i < count; i++) {
    const w = i === count - 1 ? parseFloat(remaining.toFixed(2)) : equal;
    remaining -= w;
    await updateV2KpiAutoWeight(w, kpis.rows[i].id);
  }
}

export async function DELETE(req) {
  try {
    await initDb();
    const authError = await requireAuth(["super_admin", "program_manager"]);
    if (authError) return authError;
    const { id } = await req.json();
    // Get program_id before deleting
    const kpi = await getV2KpiProgramId(id);
    const programId = kpi.rows[0]?.program_id;
    await deleteV2Kpi(id);
    // Redistribute weights for remaining KPIs
    if (programId) await redistributeProgramWeights(programId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
