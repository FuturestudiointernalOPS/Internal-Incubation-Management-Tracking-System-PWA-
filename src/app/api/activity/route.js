import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import { listActivityLogs, createActivityLog } from "@/models/workspace";

export const GET = createHandler(
  { roles: ["staff", "super_admin"] },
  async () => {
    const result = await listActivityLogs();
    return NextResponse.json({ success: true, activity: result.rows });
  },
);

export const POST = createHandler(
  { roles: ["staff", "super_admin"] },
  async (req) => {
    const { user, action } = await req.json();
    await createActivityLog(user || "System", action);
    return NextResponse.json({ success: true });
  },
);
