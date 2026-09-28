import db from "@/lib/db";

/**
 * The public SALE LINK of a course — the one thing the outside world needs.
 *
 * The website names a programme and ImpactOS answers with the Execution that
 * sells the best-matching course (see courseMatch.js); the address of that
 * Execution is resolved here.
 *
 * The course's own public catalogue, its detail sheet and the free
 * self-enrollment that lived behind them used to sit in this module. They were
 * addressed by a course "slug", linked from nowhere, and the website never used
 * them — only the sale link above is still needed, so they were removed with
 * the slug.
 */

/**
 * The public address (slug) of the ACTIVE Execution that sells a course.
 *
 * This is what makes the website's buy links follow the course ↔ Execution
 * link: the team attaches an Execution to a course in ImpactOS, and the website
 * discovers the address from the course — nobody copies a link by hand.
 *
 * A course may be linked to several Executions over time; linking refreshes
 * `updated_at`, so the MOST RECENTLY LINKED one wins. An Execution without a
 * public address is not reachable and is ignored, and so is one that is not
 * `active` (draft/closed). Returns null when the course is not sold through an
 * Execution — the caller then keeps whatever fallback it has.
 */
export async function getActiveCheckoutRunSlugForCourse(courseId) {
  if (!courseId) return null;

  const res = await db.execute({
    sql: `SELECT public_slug, updated_at
          FROM platform_form_runs
          WHERE lms_course_id = ? AND status = ?`,
    args: [String(courseId), "active"],
  });

  // Pick in code rather than in SQL so the rule is the same wherever it runs and
  // stays testable: keep the reachable ones, take the newest link.
  const reachable = res.rows.filter((row) => String(row.public_slug || "").trim());
  if (reachable.length === 0) return null;

  const newest = reachable.reduce((best, row) =>
    new Date(row.updated_at || 0).getTime() > new Date(best.updated_at || 0).getTime()
      ? row
      : best,
  );
  return String(newest.public_slug).trim();
}
