import { createHandler } from "@/lib/api/createHandler";
import { NextResponse } from "next/server";
import { getAdminBlockerRows } from "@/models/tasks";

export const GET = createHandler({ roles: ["super_admin"] }, async (req) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const task_id = searchParams.get("task_id");

  const result = await getAdminBlockerRows(status, task_id);
  return NextResponse.json({ success: true, blockers: result.rows });
});
