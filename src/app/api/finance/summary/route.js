import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireCapabilityV2 } from "@/lib/auth";
import { getSummary } from "@/lib/finance/queries";

export const GET = createHandler({ roles: ["super_admin", "staff"] }, async (req) => {
  const capError = await requireCapabilityV2("finance", "view");
  if (capError) return capError;
  const { searchParams } = new URL(req.url);
  const dataSourceId = searchParams.get("dataSourceId") || null;
  const year = searchParams.get("year") || null;
  const summary = await getSummary(dataSourceId, year);
  return NextResponse.json({ success: true, ...summary });
});
