import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getDataSources } from "@/lib/finance/queries";

export const GET = createHandler({ roles: ["super_admin"] }, async () => {
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
});
