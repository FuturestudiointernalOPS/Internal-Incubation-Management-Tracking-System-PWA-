/**
 * LMS learner experience services.
 *
 * Access model (server-side, never trust client IDs):
 *   User → valid lms_enrollment → Course → Access
 *
 * Progress model (Phase 1 schema):
 *   - lessons:  lms_lesson_progress (one row per enrollment+lesson, idempotent)
 *   - progress = completed required components / total required components × 100
 *     where a required assessment counts when the learner has PASSED it
 *     (Phase 4). Optional components never block completion.
 *
 * Assessment flow (Phase 4):
 *   start → answer → submit → server-side scoring → attempt row → PASS/FAIL
 *   Unlimited retries; every attempt is persisted; attempt numbers are derived
 *   server-side inside a transaction (UNIQUE(user_cid, assessment_id,
 *   attempt_number) guards concurrent submissions).
 *
 * Certificate flow (Phase 5):
 *   The completion decision stays HERE (single authoritative engine). When a
 *   course becomes complete, the enrollment is marked completed (first
 *   `completed_at` wins) and a certificate is issued idempotently — one
 *   certificate per completed enrollment, server-side only.
 *
 * Layer (see docs/LAYER_SPLIT.md): the decisions live in `./learning/` — the
 * read surface (`structure`), the pure calculation (`progress`) and its read-backed
 * wrapper (`enrollmentProgress`), the completion/certificate engine
 * (`completion`), then the four use-case faces: the learner screens (`catalog`),
 * the lesson write path (`lessons`), assessment taking (`assessments`) and the
 * admin enabler (`enrollments`). This file re-exports the same public surface, so
 * importers and tests are unchanged.
 *
 * Every statement lives in `@/models/lms/learningStore`.
 */

export { loadEnrollmentProgress, loadStructure, getEnrollment, loadAssessmentStates } from "./learning/structure";
export { computeCourseProgress, findContinueLesson } from "./learning/progress";
export { learnerHasEnrollments, getLearnerCourses, getLearnerCourse } from "./learning/catalog";
export { completeLesson } from "./learning/lessons";
export { getAssessmentForTake, submitAssessment } from "./learning/assessments";
export { enrollLearner, listEnrollments } from "./learning/enrollments";