import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureAccess, isStaffActorForVenture } from "@/lib/ventureAuth";

/**
 * GET /api/ventures/[id]/submissions/review-queue
 *
 * Staff attention list: the LATEST submission of every task that is still
 * awaiting a review decision (staff have not yet approved or requested
 * changes). Powers the Coach/Venture Support "Needs your attention" card.
 *
 * Gate: staff actor on the Venture (global role or active assignment).
 * Founders/team members get 403 — they submit work but do not see the queue.
 */
export const GET = createHandler(async (req, { params }) => {
  const { id } = await params;
  const { session } = await requireVentureAccess(id, db);
  if (!session) return NextResponse.json({ success: false, error: "errors.notFound" }, { status: 404 });
  if (!(await isStaffActorForVenture(db, id, session))) {
    return NextResponse.json({ success: false, error: "This operation requires staff access to the Venture." }, { status: 403 });
  }

  const ventureRes = await db.execute({ sql: "SELECT id FROM ventures WHERE venture_id = ?", args: [id] });
  const dbId = ventureRes.rows?.[0]?.id;
  if (!dbId) return NextResponse.json({ success: false, error: "Venture not found" }, { status: 404 });

  const r = await db.execute({
    sql: `SELECT s.id AS submission_id, s.task_id, s.version, s.file_url, s.file_name, s.notes,
                 s.submitted_by_name, s.created_at,
                 t.title AS task_title,
                 m.title AS milestone_title
          FROM venture_task_submissions s
          JOIN venture_tasks t ON t.id = s.task_id
          LEFT JOIN venture_milestones m ON m.id::text = t.milestone_id::text
          WHERE t.venture_id = ?
            AND s.review_decision IS NULL
            AND s.version = (SELECT MAX(s2.version) FROM venture_task_submissions s2 WHERE s2.task_id = s.task_id)
          ORDER BY s.created_at DESC
          LIMIT 20`,
    args: [dbId],
  }).catch(() => ({ rows: [] }));

  return NextResponse.json({ success: true, items: r.rows || [] });
});
