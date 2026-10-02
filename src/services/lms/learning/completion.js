/**
 * LMS learner experience — completion + certificate (single authoritative path).
 *
 * Layer (see docs/LAYER_SPLIT.md): the decisions live here; every statement
 * lives in `@/models/lms/learningStore`.
 */

import { updateEnrollmentCompleted } from "@/models/lms/learningStore";
import { ensureCertificateForEnrollment } from "@/models/lms/certificates";

/**
 * Persist course completion and issue the certificate — the ONLY place where
 * an enrollment transitions to completed. Both mutation entry points
 * (completeLesson, submitAssessment) and the read surfaces funnel through the
 * same completion engine + this finalizer, so there is never a second,
 * conflicting completion calculation (spec §5).
 *
 * - Completion never moves backwards: the enrollment is only ever updated to
 *   'completed' and the original completed_at is preserved (COALESCE).
 * - The persisted enrollment status is authoritative: an enrollment completed
 *   before this phase shipped receives its certificate lazily (idempotent),
 *   even if current content edits would change the computed progress.
 * - Certificate issuance is idempotent (one per completed enrollment).
 */
export async function finalizeCourseCompletion({ course, enrollment, courseProgress }) {
  if (courseProgress.complete && enrollment.status !== "completed") {
    await updateEnrollmentCompleted(enrollment.id);
    enrollment = { ...enrollment, status: "completed" };
  }
  // Null while the enrollment is not completed; existing certificate otherwise.
  return ensureCertificateForEnrollment({ course, enrollment });
}