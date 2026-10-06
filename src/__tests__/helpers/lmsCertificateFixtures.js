/**
 * Certificate fixtures for the LMS suites, bound to one fake database.
 *
 * A factory rather than a module of constants: the fake DB is created per test
 * file, so the seeds have to write into THAT instance. Callers do
 * `const fx = createCertificateFixtures(mockFake)`.
 */

module.exports = function createCertificateFixtures(mockFake) {
  const PUBLISHED = {
    id: "C-1",
    title: "Customer Discovery",
    description: "Learn customer discovery.",
    status: "published",
    is_free: true,
    visibility: "public",
    updated_at: "2026-08-27T00:00:00Z",
  };
  const SECTION_1 = { id: "S-1", course_id: "C-1", title: "Introduction", position: 0 };
  const LESSON_1 = {
    id: "L-1",
    section_id: "S-1",
    title: "Lesson 1",
    content_type: "video",
    youtube_video_id: "aaaaaaaaaaa",
    is_required: true,
    position: 0,
  };
  const LESSON_2 = {
    id: "L-2",
    section_id: "S-1",
    title: "Lesson 2",
    content_type: "video",
    youtube_video_id: "bbbbbbbbbbb",
    is_required: true,
    position: 1,
  };
  const LESSON_OPT = {
    id: "L-3",
    section_id: "S-1",
    title: "Optional extra",
    content_type: "video",
    youtube_video_id: "ccccccccccc",
    is_required: false,
    position: 2,
  };

  function seedCourse({ lessons = [LESSON_1, LESSON_2], assessments = [] } = {}) {
    mockFake.seed("lms_courses", [PUBLISHED]);
    mockFake.seed("lms_course_sections", [SECTION_1]);
    mockFake.seed("lms_lessons", lessons);
    mockFake.seed("lms_assessments", assessments);
  }

  function seedEnrollment({ status = "active", id = "E-1", userCid = "U-LEARNER" } = {}) {
    mockFake.seed("lms_enrollments", [
      { id, course_id: "C-1", user_cid: userCid, source: "admin", status, completed_at: null },
    ]);
  }

  function seedContact(userCid = "U-LEARNER", name = "Jane Learner") {
    mockFake.seed("contacts", [{ cid: userCid, name, email: "jane@future.studio" }]);
  }

  function seedCertificate({
    id = "CRT-1",
    number = "CERT-2026-000001",
    token = "abc123def456abc123def456",
    enrollmentId = "E-1",
    courseId = "C-1",
    userCid = "U-LEARNER",
    learnerName = "Jane Learner",
    courseTitle = "Customer Discovery",
    issuedAt = "2026-08-31T14:35:00Z",
    status = "valid",
  } = {}) {
    mockFake.seed("lms_certificates", [
      {
        id,
        certificate_number: number,
        verification_token: token,
        enrollment_id: enrollmentId,
        course_id: courseId,
        user_cid: userCid,
        learner_name: learnerName,
        course_title: courseTitle,
        issued_at: issuedAt,
        status,
        revoked_at: null,
        created_at: "2026-08-31T14:35:00Z",
        updated_at: "2026-08-31T14:35:00Z",
      },
    ]);
  }

  const certRows = () => mockFake.state.lms_certificates;

  return {
    PUBLISHED,
    SECTION_1,
    LESSON_1,
    LESSON_2,
    LESSON_OPT,
    seedCourse,
    seedEnrollment,
    seedContact,
    seedCertificate,
    certRows,
  };
};
