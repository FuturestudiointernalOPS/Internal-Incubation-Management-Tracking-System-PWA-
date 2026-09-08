import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { requireAuthorization } from "@/lib/authorization";
import { getStorageInfo } from "@/lib/ventures";

export const GET = createHandler(async () => {
  const capError = await requireAuthorization("settings", "view");
  if (capError) return capError;

  const storage = await getStorageInfo();
    return NextResponse.json({ success: true, ...storage });
  }
);
