/**
 * LMS learner experience — the admin enrollment enabler.
 *
 * Layer (see docs/LAYER_SPLIT.md): decisions here, every statement in
 * `@/models/lms/learningStore`.
 */

import { LmsError } from "@/models/lms/errors";
import { getCourse } from "@/models/lms/courses";
import {
  selectContactCidByEmail,
  insertEnrollment,
  selectEnrollmentsByCourse,
  selectContactsByCids,
} from "@/models/lms/learningStore";

export async function enrollLearner({ courseId, userCid, userEmail, source }) {
  const course = await getCourse(courseId);
  if (!course) throw new LmsError("lms.errors.courseNotFound", 404);

  let cid = userCid;
  if (!cid && userEmail) {
    const res = await selectContactCidByEmail(userEmail);
    if (res.rows.length === 0) throw new LmsError("lms.errors.userNotFound", 404);
    cid = res.rows[0].cid;
  }
  if (!cid) throw new LmsError("lms.errors.userNotFound", 400);

  await insertEnrollment(courseId, cid, source);
  return { success: true, courseId, userCid: cid };
}

export async function listEnrollments(courseId) {
  const enrollRes = await selectEnrollmentsByCourse(courseId);
  const enrollments = enrollRes.rows;
  const cids = [...new Set(enrollments.map((enrollment) => enrollment.user_cid))];
  const byCid = new Map();
  if (cids.length > 0) {
    const contactsRes = await selectContactsByCids(cids);
    for (const contact of contactsRes.rows) byCid.set(String(contact.cid), contact);
  }
  return enrollments.map((enrollment) => ({
    id: enrollment.id,
    user_cid: enrollment.user_cid,
    source: enrollment.source,
    status: enrollment.status,
    enrolled_at: enrollment.enrolled_at,
    completed_at: enrollment.completed_at,
    learner: byCid.get(String(enrollment.user_cid)) || null,
  }));
}