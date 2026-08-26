import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";
import { getSystemStatus } from "@/lib/ventures";

export const GET = createHandler(async () => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const status = await getSystemStatus();
    return NextResponse.json({ success: true, ...status });
  }
);
