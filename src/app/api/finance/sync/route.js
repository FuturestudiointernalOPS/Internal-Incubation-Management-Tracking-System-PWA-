import { NextResponse } from "next/server";
import db from "@/lib/db";
import { createHandler } from "@/lib/api/createHandler";
import { requireCapabilityV2 } from "@/lib/auth";
import { syncDataSource } from "@/lib/finance/ingest";

export const POST = createHandler({ roles: ["super_admin", "staff"] }, async (req) => {
  const capError = await requireCapabilityV2("finance", "create");
  if (capError) return capError;
  const { searchParams } = new URL(req.url);
  const dataSourceId = searchParams.get("dataSourceId");
  if (!dataSourceId)
    return NextResponse.json(
      { success: false, error: "Query param required: dataSourceId" },
      { status: 400 },
    );
  const ds = await db.execute({
    sql: "SELECT last_sync_at FROM data_sources WHERE id = ?",
    args: [dataSourceId],
  });
  if (ds.rows.length === 0)
    return NextResponse.json(
      { success: false, error: "Data source not found" },
      { status: 404 },
    );
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
  if (!result.success)
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 500 },
    );
  return NextResponse.json({ success: true, ...result });
});
