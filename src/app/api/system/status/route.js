import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/models/authorization/index";
import { getSystemStatus } from "@/services/ventures/monitoring";

export const GET = createHandler(async () => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const status = await getSystemStatus();
    return NextResponse.json({ success: true, ...status });
  }
);
