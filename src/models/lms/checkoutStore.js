/**
 * LMS checkout — statements (REPOSITORY layer).
 *
 * Every statement behind the paid-course checkout: the course/run lookups, the
 * purchase contact and enrollment writes, the one-time access-token writes and
 * the purchase-enrollment read used to revoke access.
 *
 * The decisions (what is sellable, whether a run is paid, what the payer may be
 * handed, when the access window is open, how a failed access is recorded) live
 * in `@/services/lms/checkout`.
 *
 * SQL is byte-identical to what used to sit inline in `models/lms/checkout.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

// ─── The run <-> course link ────────────────────────────────────────────────

/** The course row the checkout reads its price from (or none). */
export function selectCheckoutCourse(courseId) {
  return db.execute({
    sql: `SELECT id, title, description, thumbnail_url, status, visibility, is_free, price,
                 payment_currency, payment_amount_unit, payment_consent_text
          FROM lms_courses WHERE id = ?`,
    args: [courseId],
  });
}

/** The Execution row a checkout is attached to (or none). */
export function selectRunForCheckout(runId) {
  return db.execute({
    sql: "SELECT id, lms_course_id, public_slug, form_id, status FROM platform_form_runs WHERE id = ?",
    args: [runId],
  });
}

/** Attach (or detach, when `courseId` is null) the course an Execution sells. */
export function updateRunCourse(runId, courseId) {
  return db.execute({
    sql: "UPDATE platform_form_runs SET lms_course_id = ?, updated_at = NOW() WHERE id = ?",
    args: [courseId, runId],
  });
}

// ─── Identity + access ──────────────────────────────────────────────────────

/** The live contact with this email (or none). */
export function selectPurchaseContact(email) {
  return db.execute({
    sql: "SELECT cid, name, email, status, password, language FROM contacts WHERE email = ? AND deleted = 0",
    args: [email],
  });
}

/** Create the pending LMS participant a purchase enrolls. */
export function insertPurchaseContactRow({ cid, name, email, phone, language }) {
  return db.execute({
    sql: `INSERT INTO contacts (cid, name, email, phone, role, status, group_name, language, created_at)
          VALUES (?, ?, ?, ?, 'participant', 'pending', 'LMS', ?, NOW())`,
    args: [cid, name, email, phone, language],
  });
}

/** Enroll the buyer (idempotent). */
export function insertPurchaseEnrollmentRow(courseId, userCid) {
  return db.execute({
    sql: `INSERT INTO lms_enrollments (course_id, user_cid, source)
          VALUES (?, ?, 'purchase')
          ON CONFLICT (course_id, user_cid) DO NOTHING`,
    args: [courseId, userCid],
  });
}

/** The purchase enrollment this checkout created for a course + user (or none). */
export function selectPurchaseEnrollment(courseId, userCid) {
  return db.execute({
    sql: "SELECT id FROM lms_enrollments WHERE course_id = ? AND user_cid = ? AND source = 'purchase'",
    args: [courseId, userCid],
  });
}

/** Suspend one enrollment (the platform's "no access" state). */
export function suspendEnrollment(enrollmentId) {
  return db.execute({
    sql: "UPDATE lms_enrollments SET status = 'suspended' WHERE id = ?",
    args: [enrollmentId],
  });
}

/** Invalidate every unused one-time password link of a contact. */
export function invalidateAccessTokens(contactCid) {
  return db.execute({
    sql: "UPDATE password_setup_tokens SET used = 1 WHERE contact_cid = ?",
    args: [contactCid],
  });
}

/** Store the HASH of a fresh one-time password link (48h). */
export function insertAccessToken(tokenHash, contactCid) {
  return db.execute({
    sql: `INSERT INTO password_setup_tokens (token_hash, contact_cid, expires_at)
          VALUES (?, ?, NOW() + INTERVAL '48 hours')`,
    args: [tokenHash, contactCid],
  });
}
