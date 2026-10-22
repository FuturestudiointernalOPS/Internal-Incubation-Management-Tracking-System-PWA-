import { createHandler } from "@/lib/api/createHandler";
import { NextResponse } from "next/server";
import { requireAuthorization } from "@/models/authorization/index";
import { getAdminBlockerRows } from "@/models/tasks";

export const GET = createHandler(async (req) => {
  const capError = await requireAuthorization("tasks", "view");
  if (capError) return capError;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const task_id = searchParams.get("task_id");

  const result = await getAdminBlockerRows(status, task_id);
  return NextResponse.json({ success: true, blockers: result.rows });
});
