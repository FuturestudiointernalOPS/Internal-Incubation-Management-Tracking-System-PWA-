import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getIntelligenceMetrics } from "@/models/intelligence";

export const GET = createHandler({ roles: ["super_admin"] }, async () => {
  const metrics = await getIntelligenceMetrics();
  return NextResponse.json({ success: true, ...metrics });
});