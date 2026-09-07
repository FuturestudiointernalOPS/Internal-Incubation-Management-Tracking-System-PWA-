import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";
import { getSummary } from "@/lib/finance/queries";

export const GET = createHandler(async (req) => {
  const capError = await requireAuthorization("finance", "view");
  if (capError) return capError;
  const { searchParams } = new URL(req.url);
  const dataSourceId = searchParams.get("dataSourceId") || null;
  const year = searchParams.get("year") || null;
  const summary = await getSummary(dataSourceId, year);
  return NextResponse.json({ success: true, ...summary });
});
