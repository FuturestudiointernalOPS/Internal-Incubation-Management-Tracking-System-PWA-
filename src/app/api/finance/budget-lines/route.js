import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getBudgetLines } from "@/lib/finance/queries";

export const GET = createHandler({ roles: ["super_admin"] }, async (req) => {
  const { searchParams } = new URL(req.url);
  const dataSourceId = searchParams.get("dataSourceId") || null;
  const year = searchParams.get("year") || null;
  const result = await getBudgetLines(dataSourceId, year);
  return NextResponse.json({ success: true, ...result });
});
