import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { getDataSources } from "@/services/finance/queries";

export const GET = createHandler(async () => {
  const authError = await requireAuthorization("finance", "view");
  if (authError) return authError;

  const rows = await getDataSources();
  const dataSources = rows.map((row) => ({
    id: row.id,
    name: row.name,
    sourceType: row.source_type,
    fiscalYear: row.fiscal_year,
    status: row.status,
    lastSyncAt: row.last_sync_at,
    lastSyncStatus: row.last_sync_status,
    syncCount: row.sync_count,
  }));
  return NextResponse.json({ success: true, dataSources });
});
