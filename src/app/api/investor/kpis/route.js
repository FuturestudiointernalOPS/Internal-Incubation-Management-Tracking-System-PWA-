import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/lib/authorization";

export async function GET(req) {
  try {
    await initDb();
    const capError = await requireAuthorization("investor", "view");
    if (capError) return capError;

    const { searchParams } = new URL(req.url);
    const ventureId = searchParams.get("venture_id");
    if (!ventureId) return NextResponse.json({ success: false, error: "venture_id required" }, { status: 400 });

    const result = await db.execute({
      sql: "SELECT * FROM venture_kpis WHERE venture_id = ? ORDER BY kpi_key",
      args: [ventureId],
    });
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

    await db.execute({
      sql: `INSERT INTO venture_kpis (venture_id, kpi_key, kpi_label, kpi_value, trend)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (venture_id, kpi_key)
            DO UPDATE SET kpi_label = EXCLUDED.kpi_label, kpi_value = EXCLUDED.kpi_value,
                          trend = EXCLUDED.trend, updated_at = NOW()`,
      args: [venture_id, kpi_key, kpi_label, kpi_value, trend || "stable"],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
