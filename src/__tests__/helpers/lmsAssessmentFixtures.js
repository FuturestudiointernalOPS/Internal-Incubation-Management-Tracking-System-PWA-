/**
 * Assessment fixtures for the LMS suites, bound to one fake database.
 *
 * A factory rather than a module of constants: the fake DB is created per test
 * file, so the seeds have to write into THAT instance. Callers do
 * `createAssessmentFixtures(mockFake)`.
 */

module.exports = function createAssessmentFixtures(mockFake) {
  const COURSE = {
    id: "C-1",
    title: "Customer Discovery",
    status: "published",
    is_free: true,
    visibility: "public",
    updated_at: "2026-08-27T00:00:00Z",
  };
  const SECTION = { id: "S-1", course_id: "C-1", title: "Intro", position: 0 };
  const LESSON = {
    id: "L-1",
    section_id: "S-1",
    title: "Lesson",
    content_type: "video",
    youtube_video_id: "dQw4w9WgXcQ",
    is_required: true,
    position: 0,
  };
  const ASSESSMENT = {
    id: "A-1",
    course_id: "C-1",
    section_id: "S-1",
    title: "Knowledge Check",
    is_required: true,
    pass_mark: 70,
    position: 0,
  };
  const Q_MC = {
    id: "Q-1",
    assessment_id: "A-1",
    question: "What is customer discovery?",
    question_type: "multiple_choice",
    options: [
      { key: "A", text: "One" },
      { key: "B", text: "Two" },
    ],
    correct_answer: ["B"],
    position: 0,
  };
  const Q_TF = {
    id: "Q-2",
    assessment_id: "A-1",
    question: "Interviews validate assumptions.",
    question_type: "true_false",
    options: [],
    correct_answer: ["true"],
    position: 1,
  };

  function seedCourseWithAssessment() {
    mockFake.seed("lms_courses", [COURSE]);
    mockFake.seed("lms_course_sections", [SECTION]);
    mockFake.seed("lms_lessons", [LESSON]);
    mockFake.seed("lms_assessments", [ASSESSMENT]);
    mockFake.seed("lms_assessment_questions", [Q_MC, Q_TF]);
  }

  function seedEnrollment() {
    mockFake.seed("lms_enrollments", [
      { id: "E-1", course_id: "C-1", user_cid: "U-LEARNER", source: "admin", status: "active" },
    ]);
  }

  const correctAnswers = [
    { questionId: "Q-1", answer: "B" },
    { questionId: "Q-2", answer: "true" },
  ];

  return {
    COURSE,
    SECTION,
    LESSON,
    ASSESSMENT,
    Q_MC,
    Q_TF,
    seedCourseWithAssessment,
    seedEnrollment,
    correctAnswers,
  };
};
