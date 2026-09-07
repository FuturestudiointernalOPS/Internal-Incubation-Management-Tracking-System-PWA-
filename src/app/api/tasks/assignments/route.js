import { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAuth, getSession } from "@/lib/auth";
import { standupUpsert } from "@/lib/standupUpsert";
import {
  getAssignments,
  getAssignmentById,
  getTaskAssignmentMeta,
  declineAssignment,
  createAssignmentDeclinedNotification,
  acceptAssignment,
  updateTaskAssignedTo,
  getContactById,
  createAssignmentAcceptedNotification,
  getTaskAssignmentContext,
  declineAssignmentForReassign,
  clearTaskAssignee,
  createAssignment,
  createAssignmentReassignedNotification,
} from "@/models/taskAssignments";

/**
 * GET  /api/tasks/assignments?assignee_id=X&status=pending
 * POST /api/tasks/assignments/respond  { assignment_id, action: "accept"|"decline" }
 */
export async function GET(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();
    const { searchParams } = new URL(req.url);
    const staffSide = [
      "super_admin",
      "staff",
      "program_manager",
      "teacher",
      "developer",
    ];
    let assignee_id = searchParams.get("assignee_id");
    if (!staffSide.includes(session.role)) {
      if (assignee_id && String(assignee_id) !== String(session.cid)) {
        return NextResponse.json(
          {
            success: false,
            error: "You can only view your own assignments.",
          },
          { status: 403 },
        );
      }
      assignee_id = assignee_id || session.cid;
    }
    const status = searchParams.get("status") || "pending";

    const result = await getAssignments(assignee_id, status);
    return NextResponse.json({ success: true, assignments: result.rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    await initDb();
    const authError = await requireAuth();
    if (authError) return authError;
    const session = await getSession();
    const { assignment_id, action, new_assignee_id } = await req.json();

    if (!assignment_id || !action) {
      return NextResponse.json(
        { success: false, error: "assignment_id and action required" },
        { status: 400 },
      );
    }

    const inv = await getAssignmentById(assignment_id);
    if (inv.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Assignment not found" },
        { status: 404 },
      );
    }
    const a = inv.rows[0];

    // Accept/decline only valid for pending assignments
    if (action !== "reassign" && a.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "Assignment no longer pending" },
        { status: 400 },
      );
    }

    const userCid = session.cid;

    // Reassign: only assigner or super_admin may act
    if (action === "reassign") {
      if (!new_assignee_id) {
        return NextResponse.json(
          { success: false, error: "new_assignee_id required for reassign" },
          { status: 400 },
        );
      }
      if (session.role !== "super_admin" && a.assigner_id !== userCid) {
        return NextResponse.json(
          { success: false, error: "Only the assigner can reassign" },
          { status: 403 },
        );
      }
    } else {
      // Accept/decline: only the assignee can respond
      if (a.assignee_id !== userCid) {
        return NextResponse.json(
          { success: false, error: "Only the assignee can respond" },
          { status: 403 },
        );
      }
    }

    // Get task info
    const taskRes = await getTaskAssignmentMeta(a.task_id);
    const task = taskRes.rows[0];

    if (action === "decline") {
      await declineAssignment(assignment_id);
      // Notify assigner
      await createAssignmentDeclinedNotification(
        a.assigner_id,
        "Assignment Declined",
        `${session.name || userCid} declined task "${task?.title || "#" + a.task_id}"`,
        "task_assignment",
      );
      return NextResponse.json({ success: true, action: "declined" });
    }

    if (action === "accept") {
      await acceptAssignment(assignment_id);

      // Update task's assigned_to
      await updateTaskAssignedTo(a.assignee_id, a.task_id);

      // Sync to assignee's standup
      if (task) {
        const contactRes = await getContactById(a.assignee_id);
        const contact = contactRes.rows[0] || {};
        try {
          await standupUpsert({
            user_id: a.assignee_id,
            user_name: contact.name || a.assignee_id,
            user_role: contact.role || "staff",
            week_number: task.created_week || 0,
            year: task.created_year || 0,
            taskContext: { title: task.title, status: "in_progress" },
          });
        } catch (_) {}
      }

      // Notify assigner
      await createAssignmentAcceptedNotification(
        a.assigner_id,
        "Assignment Accepted",
        `${session.name || userCid} accepted task "${task?.title || "#" + a.task_id}"`,
        "task_assignment",
      );

      return NextResponse.json({ success: true, action: "accepted" });
    }

    if (action === "reassign") {
      // Permission already checked above — only assigner/super_admin reaches here

      // PHASE 2: Contact Group enforcement
      if (session.role !== "super_admin") {
        const { validateTaskAssignment } = await import("@/lib/contactGroups");
        // Fetch task context for venture check
        const taskCtx = await getTaskAssignmentContext(a.task_id);
        const ctx = taskCtx.rows[0] || {};
        const groupCheck = await validateTaskAssignment(
          userCid,
          new_assignee_id,
          { context_type: ctx.context_type || "staff", context_id: ctx.context_id || null },
        );
        if (!groupCheck.allowed) {
          return NextResponse.json(
            {
              success: false,
              error: `Cannot reassign outside your Contact Group. ${groupCheck.reason || "No shared group found."}`,
            },
            { status: 403 },
          );
        }
      }

      // If old assignment was pending, mark it declined so it drops from old assignee's list
      if (a.status === "pending") {
        await declineAssignmentForReassign(assignment_id);
      }

      // If old assignment was already accepted, clear tasks.assigned_to back to NULL
      if (a.status === "accepted") {
        await clearTaskAssignee(a.task_id);
      }

      // Insert new pending row for the new assignee
      await createAssignment(a.task_id, userCid, new_assignee_id);

      // Notify new assignee
      await createAssignmentReassignedNotification(
        new_assignee_id,
        "New Task Assignment",
        `${session.name || userCid} reassigned you task "${task?.title || "#" + a.task_id}"`,
        "task_assignment",
      );

      return NextResponse.json({ success: true, action: "reassigned" });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 },
    );
  } catch (error) {
    console.error("POST assignments error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
