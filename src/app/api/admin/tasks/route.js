import { createHandler } from "@/lib/api/createHandler";
import { NextResponse } from "next/server";
import { getAdminTaskBlockers, getAdminTaskRows } from "@/models/tasks";

export const GET = createHandler({ roles: ["super_admin"] }, async (req) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const project_id = searchParams.get("project_id");
  const user_id = searchParams.get("user_id");

  const result = await getAdminTaskRows(status, project_id, user_id);
  const tasks = result.rows;

  // Batch the per-task blocker query into one IN query instead of 1 DB
  // round-trip PER task (up to 200). Produces identical per-task `blockers`
  // arrays ordered created_at DESC.
  const taskIds = tasks.map((t) => t.id);
  let blockersByTask = {};
  if (taskIds.length > 0) {
    const blockerRes = await getAdminTaskBlockers(taskIds);
    for (const r of blockerRes.rows || []) {
      const id = String(r.task_id);
      if (!blockersByTask[id]) blockersByTask[id] = [];
      const { task_id, ...rest } = r;
      blockersByTask[id].push(rest);
    }
  }

  const enriched = tasks.map((task) => ({
    ...task,
    blockers: blockersByTask[String(task.id)] || [],
  }));
  return NextResponse.json({ success: true, tasks: enriched });
});
