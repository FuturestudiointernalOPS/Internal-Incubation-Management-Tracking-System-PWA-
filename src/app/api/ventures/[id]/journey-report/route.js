import db, { initDb } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireVentureAccess, roleIsPrivileged, isStaffActorForVenture } from "@/lib/ventureAuth";
import { TASK_COMPLETED_STATUSES, isMilestoneComplete, isJourneyStageComplete } from "@/lib/ventureStatuses";

export const dynamic = "force-dynamic";

// Statuses that still need work — anything not terminal-success or cancelled.
const OPEN_TASK_STATUSES = [
  "backlog", "todo", "in_progress", "review",
  "revision_requested", "rejected", "blocked",
];

const OWNERS_IN = (owners) => `IN (${owners.map(() => "?").join(", ")})`;

/**
 * GET /api/ventures/[id]/journey-report — operating report over the defined
 * roadmap (Vinance 3 — Phase 3, doc §20). Read-only: every number is
 * computed live from the canonical spine (journeys → milestones → tasks →
 * submissions/sessions), nothing is manually maintained.
 *
 * Staff-only (global role or active Venture assignment) — founders use their
 * own guided views, not the operating report.
 */
export async function GET(req, { params }) {
  try {
    await initDb();
    const { id } = await params;
    const { session } = await requireVentureAccess(id, db);
    if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });

    const staff =
      roleIsPrivileged(session.role) ||
      (session.cid ? await isStaffActorForVenture(db, id, session) : false);
    if (!staff) {
      return NextResponse.json({ success: false, error: "Staff access required." }, { status: 403 });
    }

    const ventureResult = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?", args: [id, id] }).catch(() => ({ rows: [] }));
    const dbId = ventureResult.rows?.[0]?.id || null;
    const owners = [id, dbId].filter(Boolean);
    const ownersSql = OWNERS_IN(owners);

    const [stagesResult, milestonesResult, tasksResult, submissionsResult, sessionsResult, supportResult, deliverablesResult] = await Promise.all([
      // Archived journeys (soft-deleted) are excluded from the operating
      // report. Guarded: a pre-migration database without the archive column
      // falls back to the plain stage read.
      db.execute({
        sql: `SELECT id, name, status, stage_order, target_date, completed_at
              FROM venture_journey_stages WHERE venture_id = ? AND COALESCE(is_archived, FALSE) = FALSE
              ORDER BY stage_order ASC`,
        args: [dbId],
      }).catch(() =>
        db.execute({
          sql: `SELECT id, name, status, stage_order, target_date, completed_at
                FROM venture_journey_stages WHERE venture_id = ?
                ORDER BY stage_order ASC`,
          args: [dbId],
        }).catch(() => ({ rows: [] })),
      ),
      db.execute({
        sql: `SELECT journey_stage_id, status FROM venture_milestones
              WHERE venture_id ${ownersSql} AND journey_stage_id IS NOT NULL`,
        args: owners,
      }).catch(() => ({ rows: [] })),
      db.execute({
        sql: `SELECT status, due_date FROM venture_tasks WHERE venture_id ${ownersSql}`,
        args: owners,
      }).catch(() => ({ rows: [] })),
      db.execute({
        sql: `SELECT s.review_decision, s.reviewed_at
              FROM venture_task_submissions s
              JOIN venture_tasks t ON t.id = s.task_id
              WHERE t.venture_id ${ownersSql} AND s.review_decision IS NOT NULL`,
        args: owners,
      }).catch(() => ({ rows: [] })),
      db.execute({
        sql: `SELECT status, venture_facing, journey_stage_id, start_time
              FROM venture_sessions WHERE venture_id ${ownersSql}`,
        args: owners,
      }).catch(() => ({ rows: [] })),
      db.execute({
        sql: `SELECT responsibility_code, staff_contact_id, scope_type
              FROM venture_staff_assignments WHERE venture_id = ? AND status = 'active'`,
        args: [id],
      }).catch(() => ({ rows: [] })),
      // Deliverables the Venture has submitted and staff have not reviewed yet
      // ('submitted' is the awaiting-review state — a review writes
      // 'approved' / 'changes_requested'). Scoped to the Venture exactly like
      // the task / milestone / session counts above.
      db.execute({
        sql: `SELECT status FROM venture_deliverables
              WHERE venture_id ${ownersSql} AND status = 'submitted'`,
        args: owners,
      }).catch(() => ({ rows: [] })),
    ]);

    const stages = (stagesResult.rows || []).map((stage) => {
      const stageMilestones = (milestonesResult.rows || []).filter((milestone) => String(milestone.journey_stage_id) === String(stage.id));
      const total = stageMilestones.length;
      const completed = stageMilestones.filter((milestone) => isMilestoneComplete(milestone.status)).length;
      return {
        id: stage.id,
        name: stage.name,
        status: stage.status,
        stage_order: stage.stage_order,
        target_date: stage.target_date || null,
        completed_at: stage.completed_at || null,
        journey_complete: isJourneyStageComplete(stage.status),
        milestones: { total, completed, progress_pct: total > 0 ? Math.round((completed / total) * 100) : 0 },
      };
    });

    const milestoneStatuses = milestonesResult.rows || [];
    const milestonesByStatus = {};
    for (const milestone of milestoneStatuses) {
      milestonesByStatus[milestone.status] = (milestonesByStatus[milestone.status] || 0) + 1;
    }

    const taskRows = tasksResult.rows || [];
    const tasksByStatus = {};
    let completedTasks = 0;
    for (const task of taskRows) {
      tasksByStatus[task.status] = (tasksByStatus[task.status] || 0) + 1;
      if (TASK_COMPLETED_STATUSES.includes(task.status)) completedTasks += 1;
    }

    const overdue = taskRows
      .filter((task) => task.due_date && OPEN_TASK_STATUSES.includes(task.status) && new Date(task.due_date) < new Date())
      .sort((first, second) => new Date(first.due_date) - new Date(second.due_date))
      .slice(0, 50)
      .map((task) => ({ id: task.id, status: task.status, due_date: task.due_date }));

    // Deliverables awaiting staff review — counted live, never stored.
    const deliverablesAwaitingReview = (deliverablesResult.rows || []).length;

    const reviewed = submissionsResult.rows || [];
    const submissions = {
      reviewed_total: reviewed.length,
      approved: reviewed.filter((submission) => submission.review_decision === "approved").length,
      changes_requested: reviewed.filter((submission) => submission.review_decision === "changes_requested").length,
    };

    const sessions = {
      total: (sessionsResult.rows || []).length,
      by_status: (sessionsResult.rows || []).reduce((counts, session) => {
        counts[session.status] = (counts[session.status] || 0) + 1;
        return counts;
      }, {}),
      upcoming: (sessionsResult.rows || []).filter(
        (session) => session.status === "scheduled" && session.start_time && new Date(session.start_time) >= new Date(),
      ).length,
      venture_facing_scheduled: (sessionsResult.rows || []).filter(
        (session) => session.venture_facing === true && session.status === "scheduled",
      ).length,
    };

    const support = {
      assignments: (supportResult.rows || []).length,
      responsibilities: [...new Set((supportResult.rows || []).map((assignment) => assignment.responsibility_code))],
    };

    const journeyTotal = stages.length;
    const journeyCompleted = stages.filter((stage) => stage.journey_complete).length;

    return NextResponse.json({
      success: true,
      journey_report: {
        journey_progression: {
          total: journeyTotal,
          completed: journeyCompleted,
          progress_pct: journeyTotal > 0 ? Math.round((journeyCompleted / journeyTotal) * 100) : 0,
        },
        stages,
        milestones_by_status: milestonesByStatus,
        tasks_by_status: tasksByStatus,
        task_completion: {
          total: taskRows.length,
          completed: completedTasks,
          progress_pct: taskRows.length > 0 ? Math.round((completedTasks / taskRows.length) * 100) : 0,
        },
        overdue,
        submissions,
        deliverables_awaiting_review: deliverablesAwaitingReview,
        sessions,
        support,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
