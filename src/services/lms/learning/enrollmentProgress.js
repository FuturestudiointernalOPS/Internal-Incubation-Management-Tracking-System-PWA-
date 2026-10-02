/**
 * LMS learner experience — the read-backed progress of ONE enrollment.
 *
 * The shared step both write paths (lesson completion, assessment submission)
 * run after their own write, so the answer they return can never disagree with
 * the pure calculation. Internal module: it is not part of the public surface
 * of `@/services/lms/learning` (it never was), so the barrel does not re-export
 * it.
 */

import { loadStructure, loadEnrollmentProgress, loadAssessmentStates } from "./structure";
import { computeCourseProgress } from "./progress";

/** Course progress for one enrollment (lessons + assessment satisfaction). */
export async function computeEnrollmentProgress(courseId, enrollment, userCid) {
  const structure = await loadStructure(courseId);
  const progress = await loadEnrollmentProgress(enrollment.id);
  const assessmentStates = await loadAssessmentStates(userCid, courseId);
  const assessmentProgress = [...assessmentStates.values()].map((state) => ({
    id: state.id,
    is_required: state.is_required,
    passed: state.passed,
  }));
  return computeCourseProgress(structure, progress, assessmentProgress);
}