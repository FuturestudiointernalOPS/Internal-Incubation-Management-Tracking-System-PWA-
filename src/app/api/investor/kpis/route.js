import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";
import {
  listVentureKpisByVentureId,
  upsertVentureKpi,
} from "@/models/investor";

export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("investor", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const ventureId = searchParams.get("venture_id");
    if (!ventureId) return NextResponse.json({ success: false, error: "venture_id required" }, { status: 400 });

    const result = await listVentureKpisByVentureId(ventureId);
    return NextResponse.json({ success: true, kpis: result.rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("investor", "create");
    if (capError) return capError;

    const { venture_id, kpi_key, kpi_label, kpi_value, trend } = await req.json();
    if (!venture_id || !kpi_key || !kpi_label || !kpi_value) {
      return NextResponse.json({ success: false, error: "venture_id, kpi_key, kpi_label, kpi_value required" }, { status: 400 });
    }

    await upsertVentureKpi({ venture_id, kpi_key, kpi_label, kpi_value, trend });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
