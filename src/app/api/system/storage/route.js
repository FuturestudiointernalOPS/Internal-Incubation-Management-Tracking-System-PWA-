import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getStorageInfo } from "@/lib/ventures";

export const GET = createHandler(
  { roles: ["super_admin"] },
  async () => {
    const storage = await getStorageInfo();
    return NextResponse.json({ success: true, ...storage });
  }
);
