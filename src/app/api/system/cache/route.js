import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";
import { getCacheInfo } from "@/lib/ventures";

export const GET = createHandler(async () => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const cache = await getCacheInfo();
    return NextResponse.json({ success: true, ...cache });
  }
);
