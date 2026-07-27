import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { getDatabaseInfo } from "@/lib/ventures";

export const GET = createHandler(
  async () => {
    const db = await getDatabaseInfo();
    return NextResponse.json({ success: true, ...db });
  },
  { roles: ["super_admin"] }
);
