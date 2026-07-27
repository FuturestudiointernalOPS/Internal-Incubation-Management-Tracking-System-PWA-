import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getSystemStatus } from "@/lib/ventures";

export const GET = createHandler(
  async () => {
    const status = await getSystemStatus();
    return NextResponse.json({ success: true, ...status });
  },
  { roles: ["super_admin"] }
);
