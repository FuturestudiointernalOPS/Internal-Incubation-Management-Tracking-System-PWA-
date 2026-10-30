import db from "@/lib/db";
import { readProgramAccessSnapshot } from "./programReads";

export async function withOrganizationLmsRead(credentials, callback) {
  return db.transaction(async (query) => {
    await query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
    const snapshot = await readProgramAccessSnapshot(query, credentials);
    return callback({
      snapshot,
      async listCatalog(organizationId) {
        const result = await query(
          `SELECT course.id, course.title, course.description, course.thumbnail_url,
                  course.status, course.visibility, course.is_free, course.price,
                  course.created_at, course.updated_at,
                  CASE WHEN course.owner_organization_id = ? THEN 'owned' ELSE 'licensed' END AS access_source
           FROM lms_courses course
           WHERE course.owner_organization_id = ?
              OR EXISTS (
                SELECT 1 FROM organization_content_licenses license
                WHERE license.content_type = 'course'
                  AND license.content_id = course.id::text
                  AND license.owner_organization_id = course.owner_organization_id
                  AND license.licensee_organization_id = ?
                  AND license.status = 'active'
                  AND (license.starts_at IS NULL OR license.starts_at <= NOW())
                  AND (license.ends_at IS NULL OR license.ends_at > NOW())
                  AND course.status = 'published'
              )
           ORDER BY course.title, course.id
           LIMIT 200`,
          [organizationId, organizationId, organizationId],
        );
        return result.rows;
      },
      async listOwnLearning(organizationId, personId) {
        const result = await query(
          `SELECT enrollment.id AS enrollment_id, enrollment.course_id, enrollment.status,
                  enrollment.enrolled_at, enrollment.completed_at,
                  course.title, course.description, course.thumbnail_url,
                  (SELECT COUNT(*) FROM lms_lessons lesson
                   JOIN lms_course_sections section ON section.id = lesson.section_id
                   WHERE section.course_id = enrollment.course_id AND lesson.is_required = TRUE
                  ) AS required_lessons,
                  (SELECT COUNT(*) FROM lms_lesson_progress progress
                   JOIN lms_lessons lesson ON lesson.id = progress.lesson_id
                   JOIN lms_course_sections section ON section.id = lesson.section_id
                   WHERE progress.enrollment_id = enrollment.id
                     AND progress.status = 'completed' AND lesson.is_required = TRUE
                     AND section.course_id = enrollment.course_id
                  ) AS completed_required_lessons
           FROM lms_enrollments enrollment
           JOIN lms_courses course ON course.id = enrollment.course_id
           WHERE enrollment.organization_id = ? AND enrollment.user_cid = ?
             AND enrollment.status <> 'suspended'
           ORDER BY enrollment.enrolled_at DESC, enrollment.id
           LIMIT 200`,
          [organizationId, personId],
        );
        const attempts = result.rows.length
          ? await query(
            `SELECT attempt.assessment_id, attempt.score,
                    attempt.total_points, attempt.passed, attempt.completed_at,
                    assessment.course_id, assessment.title AS assessment_title
             FROM lms_assessment_attempts attempt
             JOIN lms_assessments assessment ON assessment.id = attempt.assessment_id
             JOIN lms_enrollments enrollment ON enrollment.course_id = assessment.course_id
               AND enrollment.organization_id = attempt.organization_id
               AND enrollment.user_cid = attempt.user_cid
             WHERE attempt.organization_id = ? AND attempt.user_cid = ?
               AND enrollment.status <> 'suspended'
             ORDER BY attempt.completed_at DESC NULLS LAST, attempt.id`,
            [organizationId, personId],
          )
          : { rows: [] };
        const certificates = await query(
          `SELECT id, enrollment_id, course_id, certificate_number, learner_name,
                  course_title, issued_at, status
           FROM lms_certificates
           WHERE organization_id = ? AND user_cid = ?
           ORDER BY issued_at DESC, id`,
          [organizationId, personId],
        );
        return {
          enrollments: result.rows,
          attempts: attempts.rows,
          certificates: certificates.rows,
        };
      },
    });
  });
}
