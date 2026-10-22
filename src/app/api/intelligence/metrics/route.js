import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { getIntelligenceMetrics } from "@/models/intelligence";

export const GET = createHandler(async () => {
  // The intelligence screen is part of the knowledge section.
  const capError = await requireAuthorization("knowledge", "view");
  if (capError) return capError;

  const metrics = await getIntelligenceMetrics();
  return NextResponse.json({ success: true, ...metrics });
});