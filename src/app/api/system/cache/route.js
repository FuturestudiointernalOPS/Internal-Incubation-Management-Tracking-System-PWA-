import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getCacheInfo } from "@/lib/ventures";

export const GET = createHandler(
  { roles: ["super_admin"] },
  async () => {
    const cache = await getCacheInfo();
    return NextResponse.json({ success: true, ...cache });
  }
);
