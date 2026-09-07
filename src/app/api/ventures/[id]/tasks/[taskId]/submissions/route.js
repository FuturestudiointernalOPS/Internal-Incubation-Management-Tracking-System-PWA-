import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db, { initDb } from "@/lib/db";
import { requireVentureAccess } from "@/lib/ventureAuth";

/**
 * Task submissions (Phase 2, D5) — founder submits work, staff review it.
 *
 * GET  /api/ventures/[id]/tasks/[taskId]/submissions
 *   → version history (any Venture-access holder: founders track status)
 * POST { action: "submit", file_url?, file_name?, file_type?, notes? }
 *   → append a new version (founders + staff)
 * POST { action: "review", submission_id, decision: approved|changes_requested, comment? }
 *   → staff review of the submission; approval is what satisfies a task
 *     configured with review_required = TRUE (completion authority).
 *
 * Append-only: every submission is a new row (version increments). Reviews
 * write on the reviewed submission; history is never overwritten.
 */

const REVIEWER_ROLES = ["staff", "program_manager", "super_admin", "developer", "teacher"];

async function resolveVentureDbId(ventureId) {
  const r = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [ventureId] });
  return r.rows?.[0]?.id || null;
}

async function resolveTask(taskId, ventureParam, dbId) {
  const res = await db.execute({ sql: "SELECT * FROM venture_tasks WHERE id = ?", args: [taskId] });
  const task = res.rows?.[0];
  if (!task) return null;
  const belongs =
    String(task.venture_id) === String(ventureParam) ||
    (dbId && String(task.venture_id) === String(dbId));
  return belongs ? task : null;
}

async function listSubmissions(taskId) {
  const res = await db.execute({
    sql: `SELECT id, task_id, version, status, file_url, file_name, file_type, file_size,
                 notes, submitted_by, submitted_by_name, reviewed_by, review_decision,
                 review_comment, reviewed_at, created_at
          FROM venture_task_submissions WHERE task_id = ?
          ORDER BY version ASC`,
    args: [taskId],
  });
  const rows = res.rows || [];
  return {
    submissions: rows,
    latest: rows.length ? rows[rows.length - 1] : null,
  };
}

export const GET = createHandler(async (req, { params }) => {
  const { id, taskId } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const dbId = await resolveVentureDbId(id);
  const task = await resolveTask(parseInt(taskId), id, dbId);
  if (!task) return NextResponse.json({ success: false, error: "Task not found." }, { status: 404 });
  const data = await listSubmissions(task.id);
  return NextResponse.json({ success: true, ...data });
});

export const POST = createHandler(async (req, { params }) => {
  const { id, taskId } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  const dbId = await resolveVentureDbId(id);
  const task = await resolveTask(parseInt(taskId), id, dbId);
  if (!task) return NextResponse.json({ success: false, error: "Task not found." }, { status: 404 });

  const body = await req.json();
  if (body.action === "submit") {
    const fileUrl = body.file_url ? String(body.file_url).trim() : "";
    const notes = body.notes ? String(body.notes).trim() : "";
    if (!fileUrl && !notes) {
      return NextResponse.json({ success: false, error: "Provide a file URL and/or notes for the submission." }, { status: 400 });
    }
    const verRes = await db.execute({
      sql: "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM venture_task_submissions WHERE task_id = ?",
      args: [task.id],
    });
    const version = Number(verRes.rows?.[0]?.next_version || 1);
    const ins = await db.execute({
      sql: `INSERT INTO venture_task_submissions
            (task_id, version, status, file_url, file_name, file_type, file_size, notes, submitted_by, submitted_by_name)
            VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id`,
      args: [
        task.id, version, "submitted", fileUrl || null,
        body.file_name ? String(body.file_name).slice(0, 255) : null,
        body.file_type ? String(body.file_type).slice(0, 50) : null,
        body.file_size ? parseInt(body.file_size) : null,
        notes || null, session?.cid || null, session?.name || null,
      ],
    });
    // A submission means work is happening: move backlog/todo tasks forward.
    if (["backlog", "todo", "not_started"].includes(task.status)) {
      await db.execute({ sql: "UPDATE venture_tasks SET status = 'in_progress' WHERE id = ?", args: [task.id] });
    }
    const data = await listSubmissions(task.id);
    return NextResponse.json({ success: true, submission_id: ins.rows?.[0]?.id || null, ...data });
  }

  if (body.action === "review") {
    if (!REVIEWER_ROLES.includes(session?.role)) {
      return NextResponse.json({ success: false, error: "Only Future Studio staff can review submissions." }, { status: 403 });
    }
    const submissionId = parseInt(body.submission_id);
    const decision = body.decision;
    if (!["approved", "changes_requested"].includes(decision)) {
      return NextResponse.json({ success: false, error: "Decision must be approved or changes_requested." }, { status: 400 });
    }
    const subRes = await db.execute({
      sql: "SELECT * FROM venture_task_submissions WHERE id = ? AND task_id = ?",
      args: [submissionId, task.id],
    });
    const submission = subRes.rows?.[0];
    if (!submission) return NextResponse.json({ success: false, error: "Submission not found." }, { status: 404 });

    await db.execute({
      sql: `UPDATE venture_task_submissions
            SET review_decision = ?, review_comment = ?, reviewed_by = ?, reviewed_at = NOW()
            WHERE id = ?`,
      args: [decision, body.comment ? String(body.comment) : null, session?.cid || null, submissionId],
    });
    // Approval satisfies review_required completion; changes_requested sends
    // the task back for another iteration. Statuses mirror the task review
    // vocabulary used by the tasks route.
    const taskStatus = decision === "approved" ? "accepted" : "revision_requested";
    await db.execute({ sql: "UPDATE venture_tasks SET status = ? WHERE id = ?", args: [taskStatus, task.id] });
    // Venture-facing notification + email (founders hear about review outcomes).
    try {
      const { notifyAndEmailVentureFounders } = await import("@/lib/ventureNotify");
      const approved = decision === "approved";
      await notifyAndEmailVentureFounders(db, {
        dbId,
        title: approved ? "Submission approved" : "Changes requested",
        message: `Your submission for "${task.title}" was ${approved ? "approved" : "requested changes"}.`,
        emailSubject: approved ? "Your submission was approved" : "Changes requested on your submission",
        emailLines: [
          `Your submission for the task "${task.title}" was ${approved ? "approved" : "reviewed with changes requested"}.`,
          body.comment ? `Feedback: ${body.comment}` : "",
          "Log in to ImpactOS to see the details.",
        ].filter(Boolean),
      });
    } catch (_) {}
    const data = await listSubmissions(task.id);
    return NextResponse.json({ success: true, ...data });
  }

  return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
});
