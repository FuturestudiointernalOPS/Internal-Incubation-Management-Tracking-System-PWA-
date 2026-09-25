/**
 * RECONCILE A MILESTONE'S OWN STATUS WITH THE WORK INSIDE IT — one-off, for
 * milestones whose deliverables were submitted or reviewed before the
 * deliverable flow moved the milestone's status.
 *
 * The runtime path now keeps the two in step (see
 * `syncMilestoneStatusFromDeliverables` in src/lib/ventureMilestoneEngine.js).
 * Rows written earlier still carry the status they were created with — a
 * milestone whose evidence is approved can still read `not_started` — so this
 * walks them once and writes the status the work already implies.
 *
 * The status a set of deliverables implies, most actionable first:
 *   every deliverable approved  → completed
 *   any deliverable sent back   → changes_requested
 *   any deliverable awaiting review → under_review
 *   anything started            → in_progress
 *   nothing started             → not_started
 *
 * Two lines are never crossed, exactly as at runtime:
 *   - a `locked` milestone is unreleased planning and is left alone, and
 *   - a `completed` milestone is a decision already taken and is never reopened.
 *
 * SAFE BY CONSTRUCTION
 *   - dry run unless the caller asks to apply: the preview writes nothing
 *   - idempotent: it writes only where the target differs from the current
 *     status, so a second run proposes nothing
 *   - derived, never invented: the target comes from the deliverables' own rows
 *   - it never touches `locked` or `completed` milestones, and never deletes.
 *
 * Kept in a model (all SQL lives here) and driven by
 * scripts/backfill-milestone-status.mjs.
 */

/** The one CASE that maps a deliverable row to the state it represents. */
const DELIVERABLE_STATE_SQL = `
  CASE
    WHEN approval_status = 'approved' OR status IN ('approved', 'completed', 'accepted') THEN 'approved'
    WHEN approval_status = 'rejected' OR status IN ('changes_requested', 'revision_requested') THEN 'changes_requested'
    WHEN status IN ('submitted', 'under_review', 'review') THEN 'awaiting_review'
    WHEN status = 'in_progress' THEN 'in_progress'
    ELSE 'not_started'
  END`;

/** The milestones whose work implies a different status than they carry. */
const PROPOSED_SQL = `
  WITH deliverable_states AS (
    SELECT milestone_id, ${DELIVERABLE_STATE_SQL} AS state
    FROM venture_deliverables
  ),
  aggregated AS (
    SELECT milestone_id,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE state = 'approved') AS approved,
      COUNT(*) FILTER (WHERE state = 'changes_requested') AS changes,
      COUNT(*) FILTER (WHERE state = 'awaiting_review') AS awaiting,
      COUNT(*) FILTER (WHERE state = 'in_progress') AS in_progress
    FROM deliverable_states
    GROUP BY milestone_id
  ),
  proposed AS (
    SELECT m.id, m.venture_id, m.title, m.status AS current_status,
      CASE
        WHEN a.approved = a.total THEN 'completed'
        WHEN a.changes > 0 THEN 'changes_requested'
        WHEN a.awaiting > 0 THEN 'under_review'
        WHEN a.in_progress > 0 OR a.approved > 0 THEN 'in_progress'
        ELSE 'not_started'
      END AS target_status
    FROM venture_milestones m
    JOIN aggregated a ON a.milestone_id::text = m.id::text
    WHERE m.status NOT IN ('locked', 'completed')
  )
  SELECT id, venture_id, title, current_status, target_status
  FROM proposed
  WHERE target_status <> current_status
  ORDER BY venture_id, id`;

/**
 * Report every milestone whose status no longer matches its deliverables, and
 * with `dryRun: false` write the derived status on exactly those rows.
 *
 * Returns { examined, changes, written, rows }.
 */
export async function reconcileMilestoneStatusFromDeliverables(db, { dryRun = true } = {}) {
  const examinedResult = await db.execute({ sql: "SELECT COUNT(*)::int AS n FROM venture_milestones" });
  const examined = examinedResult.rows?.[0]?.n ?? 0;

  const proposedResult = await db.execute({ sql: PROPOSED_SQL });
  const rows = proposedResult.rows || [];

  let written = 0;
  if (!dryRun && rows.length > 0) {
    const ids = rows.map((row) => String(row.id));
    const placeholders = ids.map(() => "?").join(", ");
    const updates = rows.map(() => `WHEN id::text = ? THEN ?`).join(" ");
    const updateArgs = [];
    for (const row of rows) updateArgs.push(String(row.id), row.target_status);

    // One statement, so the derived statuses are applied together and a partial
    // run cannot leave the set half-moved.
    await db.execute({
      sql: `UPDATE venture_milestones
            SET status = CASE ${updates} END, updated_at = NOW()
            WHERE id::text IN (${placeholders})`,
      args: [...updateArgs, ...ids],
    });
    written = rows.length;
  }

  return { examined, changes: rows.length, written, rows };
}

export default { reconcileMilestoneStatusFromDeliverables };
