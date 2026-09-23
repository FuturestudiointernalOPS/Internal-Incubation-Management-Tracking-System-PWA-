import { getLearnerCourses } from "./learning";
import { getCertificatesForLearner } from "./certificates";

/**
 * CRM LEARNING JOURNEY (Phase 7)
 *
 * The complete, traceable learning journey of one person — used by the CRM to
 * associate Person → Enrollment → Progress → Completion → Certificate. The
 * identity is the existing contacts.cid; the LMS is the authoritative source of
 * every progress/completion value (the CRM never recalculates anything).
 *
 * Purchases: no commercial/purchase table exists yet (payment integration is
 * intentionally deferred). The field is returned as an empty array so the CRM
 * shape is stable and the paid-course trace can land without a schema change
 * the moment a purchase table ships.
 */
export async function getLearnerJourney(cid) {
  const courses = await getLearnerCourses(cid);
  const certificates = await getCertificatesForLearner(cid);

  return {
    courses: courses.map((courseEntry) => ({
      course: {
        id: courseEntry.course.id,
        title: courseEntry.course.title,
        thumbnail_url: courseEntry.course.thumbnail_url,
        status: courseEntry.course.status,
      },
      enrollment: courseEntry.enrollment
        ? {
            source: courseEntry.enrollment.source,
            status: courseEntry.enrollment.status,
            enrolled_at: courseEntry.enrollment.enrolled_at,
            completed_at: courseEntry.enrollment.completed_at,
          }
        : null,
      progress: courseEntry.progress
        ? {
            percent: courseEntry.progress.percent,
            status: courseEntry.progress.status,
            completedLessons: courseEntry.progress.completedLessons,
            totalLessons: courseEntry.progress.totalLessons,
          }
        : null,
      certificate: courseEntry.certificate
        ? {
            certificate_number: courseEntry.certificate.certificate_number,
            status: courseEntry.certificate.status,
            issued_at: courseEntry.certificate.issued_at,
          }
        : null,
    })),
    certificates: certificates.map((cert) => ({
      certificate_number: cert.certificate_number,
      course_title: cert.course_title,
      learner_name: cert.learner_name,
      status: cert.status,
      issued_at: cert.issued_at,
    })),
    purchases: [],
  };
}
