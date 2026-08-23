import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireCapabilityV2 } from "@/lib/auth";
import { getTransactions } from "@/lib/finance/queries";

export const GET = createHandler({ roles: ["super_admin", "staff"] }, async (req) => {
  const capError = await requireCapabilityV2("finance", "view");
  if (capError) return capError;
  const { searchParams } = new URL(req.url);
  const dataSourceId = searchParams.get("dataSourceId") || null;
  const type = searchParams.get("type") || null;
  const programId = searchParams.get("programId") || null;
  const dateFrom = searchParams.get("dateFrom") || null;
  const dateTo = searchParams.get("dateTo") || null;
  const limit = parseInt(searchParams.get("limit") || "100", 10);
  const offset = parseInt(searchParams.get("offset") || "0", 10);
  const result = await getTransactions(dataSourceId, {
    type,
    programId,
    dateFrom,
    dateTo,
    limit,
    offset,
  });
  return NextResponse.json({ success: true, ...result });
});
