import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getDataSources } from "@/lib/finance/queries";

export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const rows = await getDataSources();

    const dataSources = rows.map((r) => ({
      id: r.id,
      name: r.name,
      sourceType: r.source_type,
      fiscalYear: r.fiscal_year,
      status: r.status,
      lastSyncAt: r.last_sync_at,
      lastSyncStatus: r.last_sync_status,
      syncCount: r.sync_count,
    }));

    return NextResponse.json({ success: true, dataSources });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
