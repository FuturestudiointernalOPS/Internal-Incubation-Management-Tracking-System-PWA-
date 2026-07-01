import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import db from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { syncDataSource } from "@/lib/finance/ingest";

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const dataSourceId = searchParams.get("dataSourceId");

    if (!dataSourceId) {
      return NextResponse.json(
        { success: false, error: "Query param required: dataSourceId" },
        { status: 400 },
      );
    }

    // Rate limit: check if last sync was less than 60 seconds ago
    const ds = await db.execute(
      "SELECT last_sync_at FROM data_sources WHERE id = ?",
      [dataSourceId],
    );

    if (ds.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Data source not found" },
        { status: 404 },
      );
    }

    const lastSync = ds.rows[0].last_sync_at
      ? new Date(ds.rows[0].last_sync_at).getTime()
      : 0;
    const now = Date.now();

    if (now - lastSync < 60000) {
      const waitSeconds = Math.ceil((60000 - (now - lastSync)) / 1000);
      return NextResponse.json(
        {
          success: false,
          error: `Rate limited. Please wait ${waitSeconds}s between syncs.`,
        },
        { status: 429 },
      );
    }

    const result = await syncDataSource(dataSourceId, "manual");

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
