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

    const ventureRes = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ? OR id::text = ?", args: [id, id] }).catch(() => ({ rows: [] }));
    const dbId = ventureRes.rows?.[0]?.id || null;
    const owners = [id, dbId].filter(Boolean);
    const ownersSql = OWNERS_IN(owners);

    const [stagesRes, msRes, tasksRes, subRes, sessRes, supportRes] = await Promise.all([
      db.execute({
        sql: `SELECT id, name, status, stage_order, target_date, completed_at
              FROM venture_journey_stages WHERE venture_id = ?
              ORDER BY stage_order ASC`,
        args: [dbId],
      }).catch(() => ({ rows: [] })),
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
    ]);

    const stages = (stagesRes.rows || []).map((s) => {
      const ms = (msRes.rows || []).filter((m) => String(m.journey_stage_id) === String(s.id));
      const total = ms.length;
      const completed = ms.filter((m) => isMilestoneComplete(m.status)).length;
      return {
        id: s.id,
        name: s.name,
        status: s.status,
        stage_order: s.stage_order,
        target_date: s.target_date || null,
        completed_at: s.completed_at || null,
        journey_complete: isJourneyStageComplete(s.status),
        milestones: { total, completed, progress_pct: total > 0 ? Math.round((completed / total) * 100) : 0 },
      };
    });

    const milestoneStatuses = msRes.rows || [];
    const milestonesByStatus = {};
    for (const m of milestoneStatuses) {
      milestonesByStatus[m.status] = (milestonesByStatus[m.status] || 0) + 1;
    }

    const taskRows = tasksRes.rows || [];
    const tasksByStatus = {};
    let completedTasks = 0;
    for (const t of taskRows) {
      tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1;
      if (TASK_COMPLETED_STATUSES.includes(t.status)) completedTasks += 1;
    }

    const overdue = taskRows
      .filter((t) => t.due_date && OPEN_TASK_STATUSES.includes(t.status) && new Date(t.due_date) < new Date())
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      .slice(0, 50)
      .map((t) => ({ id: t.id, status: t.status, due_date: t.due_date }));

    const reviewed = subRes.rows || [];
    const submissions = {
      reviewed_total: reviewed.length,
      approved: reviewed.filter((s) => s.review_decision === "approved").length,
      changes_requested: reviewed.filter((s) => s.review_decision === "changes_requested").length,
    };

    const sessions = {
      total: (sessRes.rows || []).length,
      by_status: (sessRes.rows || []).reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {}),
      upcoming: (sessRes.rows || []).filter(
        (s) => s.status === "scheduled" && s.start_time && new Date(s.start_time) >= new Date(),
      ).length,
      venture_facing_scheduled: (sessRes.rows || []).filter(
        (s) => s.venture_facing === true && s.status === "scheduled",
      ).length,
    };

    const support = {
      assignments: (supportRes.rows || []).length,
      responsibilities: [...new Set((supportRes.rows || []).map((a) => a.responsibility_code))],
    };

    const journeyTotal = stages.length;
    const journeyCompleted = stages.filter((s) => s.journey_complete).length;

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
        sessions,
        support,
      },
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
