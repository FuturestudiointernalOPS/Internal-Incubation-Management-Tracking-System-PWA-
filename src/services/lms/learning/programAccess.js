/**
 * LMS learner services — program-sourced access (SERVICE layer).
 *
 * A course enrollment created BY a program seat (`source: 'program'`) only
 * makes sense while that seat exists. These use cases keep the two in step:
 * when a participant leaves a program, the learning it granted is suspended;
 * and the orphan control lists/fixes the ones left behind by older data.
 *
 * "Suspended" (not deleted) is deliberate: the enrollment and its progress stay
 * readable for the team, while every learner route already treats a suspended
 * enrollment as NO access (My Learning does not list it, opening the course is
 * refused).
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions here, statements in
 * `@/models/lms/learningStore`. No SQL, no HTTP.
 */

import {
  listOrphanProgramEnrollments as selectOrphanProgramEnrollments,
  suspendProgramEnrollmentsByIds,
  suspendStaleProgramEnrollments,
} from "@/models/lms/learningStore";

/**
 * Release the learning a person's program seats granted, after their
 * memberships changed. Idempotent and safe to call on every removal: seats that
 * still exist (and seams another seat also needs) are kept.
 */
export async function releaseProgramLearning({ cid, cids } = {}) {
  const participants = (Array.isArray(cids) ? cids : cid == null ? [] : [cid])
    .map(String)
    .filter(Boolean);
  if (participants.length === 0) return { released: 0, failed: false };
  try {
    const result = await suspendStaleProgramEnrollments(participants);
    return { released: result?.rowsAffected || 0, failed: false };
  } catch (error) {
    // Never let the learning cleanup break the membership change it follows.
    console.error("[lms] releasing program learning failed:", error.message);
    return { released: 0, failed: true };
  }
}

/** Rows of program-sourced access that no program seat justifies any more. */
export async function listOrphanProgramEnrollments() {
  const result = await selectOrphanProgramEnrollments();
  return (result.rows || []).map((row) => ({
    id: String(row.id),
    user_cid: row.user_cid || null,
    user_name: row.user_name || null,
    user_email: row.user_email || null,
    course_id: String(row.course_id),
    course_title: row.course_title || null,
    program_id: row.program_id || null,
    program_name: row.program_name || null,
    status: row.status || "active",
    enrolled_at: row.enrolled_at || null,
  }));
}

/** Suspend the given orphaned enrollments. Returns how many were touched. */
export async function suspendOrphanProgramEnrollments(ids) {
  const cleanIds = (Array.isArray(ids) ? ids : []).map(String).filter(Boolean);
  if (cleanIds.length === 0) return { suspended: 0 };
  const result = await suspendProgramEnrollmentsByIds(cleanIds);
  return { suspended: result?.rowsAffected || 0 };
}
