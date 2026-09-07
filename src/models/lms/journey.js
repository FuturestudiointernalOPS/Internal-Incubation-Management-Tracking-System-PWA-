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
    courses: courses.map((c) => ({
      course: {
        id: c.course.id,
        title: c.course.title,
        thumbnail_url: c.course.thumbnail_url,
        status: c.course.status,
      },
      enrollment: c.enrollment
        ? {
            source: c.enrollment.source,
            status: c.enrollment.status,
            enrolled_at: c.enrollment.enrolled_at,
            completed_at: c.enrollment.completed_at,
          }
        : null,
      progress: c.progress
        ? {
            percent: c.progress.percent,
            status: c.progress.status,
            completedLessons: c.progress.completedLessons,
            totalLessons: c.progress.totalLessons,
          }
        : null,
      certificate: c.certificate
        ? {
            certificate_number: c.certificate.certificate_number,
            status: c.certificate.status,
            issued_at: c.certificate.issued_at,
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
