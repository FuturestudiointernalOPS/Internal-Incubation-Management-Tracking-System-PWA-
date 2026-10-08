/**
 * CHECKOUT — the run ↔ course link.
 *
 * Which course a run sells, read from the COURSE — never from the form, never
 * from the browser — and the link write that turns a normal Execution into a
 * paid checkout.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions here, every statement in
 * `@/models/lms/checkoutStore` (the schema self-heal lives beside them).
 */

import { LmsError } from "@/models/lms/errors";
import { paymentCurrency, ensureCheckoutSchema } from "@/models/lms/registrations";
import {
  selectCheckoutCourse,
  selectRunForCheckout,
  updateRunCourse,
} from "@/models/lms/checkoutStore";

/**
 * The course a run sells, with the price read from the COURSE — never from the
 * form, never from the browser. Returns null when the course is not a sellable,
 * published, public, paid course.
 */
export async function resolveCheckoutCourse(courseId) {
  if (!courseId) return null;
  await ensureCheckoutSchema();
  const res = await selectCheckoutCourse(courseId);
  const row = res.rows[0];
  if (!row) return null;
  if (row.status !== "published" || row.visibility !== "public") return null;
  if (row.is_free !== false) return null;

  const amount = Number(row.price);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    id: String(row.id),
    title: row.title,
    description: row.description,
    thumbnail_url: row.thumbnail_url,
    amount,
    // Per-course overrides, falling back to the environment.
    currency: String(row.payment_currency || paymentCurrency()).toUpperCase(),
    amountUnit: row.payment_amount_unit || null,
    consentText: row.payment_consent_text || null,
  };
}

/**
 * The paid context of a run.
 *
 *   { run, hasCourse: false }             -> a normal, free Execution (unchanged)
 *   { run, hasCourse: true, course }      -> a paid Execution, ready to sell
 *   { run, hasCourse: true, course:null } -> linked to a course that is not
 *                                            sellable: the caller MUST refuse
 *                                            rather than capture a free entry.
 */
export async function getPaidRunContext(runId) {
  if (!runId) return null;
  await ensureCheckoutSchema();
  const res = await selectRunForCheckout(runId);
  const run = res.rows[0];
  if (!run) return null;
  if (!run.lms_course_id) return { run, hasCourse: false, course: null };
  return { run, hasCourse: true, course: await resolveCheckoutCourse(run.lms_course_id) };
}

/**
 * Attach a course to an Execution (or detach it with courseId null), so the
 * Execution becomes a paid checkout. The course must be sellable — published,
 * public and paid — otherwise nothing is attached.
 */
export async function linkRunToCourse({ runId, courseId = null }) {
  if (!runId) throw new LmsError("lms.errors.invalidPayload", 400);
  await ensureCheckoutSchema();

  if (courseId) {
    const course = await resolveCheckoutCourse(courseId);
    if (!course) throw new LmsError("lms.errors.courseNotForSale", 409);
  }

  await updateRunCourse(runId, courseId || null);

  return { runId, courseId: courseId || null };
}