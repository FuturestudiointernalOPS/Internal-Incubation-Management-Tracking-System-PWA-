import { NextResponse } from "next/server";
import { createHandler } from "@/lib/api/createHandler";
import db from "@/lib/db";
import { requireVentureAccess, isStaffActorForVenture } from "@/lib/ventureAuth";
import {
  isGlobalRole,
  resolveVentureCode,
  getAssignmentScopes,
  hasVentureWideReach,
  isTaskInScope,
  listTaskScopeContexts,
} from "@/lib/ventureScope";

/**
 * GET /api/ventures/[id]/submissions/review-queue
 *
 * Staff attention list: the LATEST submission of every task that is still
 * awaiting a review decision (staff have not yet approved or requested
 * changes). Powers the Coach/Venture Support "Needs your attention" card.
 *
 * Gate: staff actor on the Venture (global role or active assignment).
 * Founders/team members get 403 — they submit work but do not see the queue.
 *
 * Assignment-scope enforcement (Vinance 3): a delegated (non-global) actor
 * only sees tasks inside one of his ACTIVE assignment scopes for the Venture.
 * Global roles, actors with NO assignment rows (legacy), and actors with a
 * venture-wide or lead_manager assignment keep the existing full-Venture
 * queue. The LIMIT-20 is applied AFTER the scope filter.
 */

// Base queue query (no LIMIT). The full-access path appends LIMIT 20 so its
// behavior stays byte-identical to the pre-scoping route.
const QUEUE_SQL_NO_LIMIT = `SELECT s.id AS submission_id, s.task_id, s.version, s.file_url, s.file_name, s.notes,
                 s.submitted_by_name, s.created_at,
                 t.title AS task_title,
                 t.milestone_id,
                 m.title AS milestone_title
          FROM venture_task_submissions s
          JOIN venture_tasks t ON t.id = s.task_id
          LEFT JOIN venture_milestones m ON m.id::text = t.milestone_id::text
          WHERE t.venture_id = ?
            AND s.review_decision IS NULL
            AND s.version = (SELECT MAX(s2.version) FROM venture_task_submissions s2 WHERE s2.task_id = s.task_id)
          ORDER BY s.created_at DESC`;
const FULL_QUEUE_SQL = `${QUEUE_SQL_NO_LIMIT}
          LIMIT 20`;

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

  // Scope the queue to the actor's assignment scopes. scopedTaskIds === null
  // means "no restriction" (global roles, zero rows, wide reach, read error).
  let scopedTaskIds = null;
  if (session?.cid && !isGlobalRole(session.role)) {
    const code = await resolveVentureCode(db, id);
    const scopes = code ? await getAssignmentScopes(db, { code, cid: session.cid }) : null;
    if (scopes && scopes.length > 0 && !hasVentureWideReach(scopes)) {
      const contexts = await listTaskScopeContexts(db, { ventureDbId: dbId });
      if (contexts) {
        scopedTaskIds = contexts
          .filter((t) => isTaskInScope(scopes, t))
          .map((t) => String(t.id));
      }
      // contexts === null (read error) → keep the full queue (reads allow).
    }
  }

  const restricted = scopedTaskIds !== null;
  const r = await db.execute({
    sql: restricted ? QUEUE_SQL_NO_LIMIT : FULL_QUEUE_SQL,
    args: [dbId],
  }).catch(() => ({ rows: [] }));

  let items = r.rows || [];
  if (restricted) {
    items = items
      .filter((row) => scopedTaskIds.includes(String(row.task_id)))
      .slice(0, 20);
  }

  // ?milestone_id= — the same queue, narrowed to one milestone. Powers the
  // review inbox inside a milestone in the Journey panel.
  const milestoneFilter = new URL(req.url).searchParams.get("milestone_id");
  if (milestoneFilter) {
    items = items.filter((row) => String(row.milestone_id ?? "") === String(milestoneFilter));
  }

  return NextResponse.json({ success: true, items });
});
