/**
 * LMS publish validation — pure unit tests (ticket §22, §35).
 * Rules are deliberately minimal: title, ≥1 section, ≥1 lesson, valid video
 * references, and well-formed assessments when they exist (never required).
 */

const { validateCourseForPublish } = require("@/lib/lms/validation");

const validCourse = {
  id: "C-1",
  title: "Customer Discovery Fundamentals",
  status: "draft",
};

const validStructure = {
  sections: [
    {
      id: "S-1",
      title: "Introduction",
      lessons: [
        {
          id: "L-1",
          title: "What is Customer Discovery?",
          content_type: "video",
          youtube_video_id: "dQw4w9WgXcQ",
        },
      ],
      assessment: null,
    },
  ],
  courseAssessments: [],
};

describe("validateCourseForPublish", () => {
  test("valid course passes", () => {
    const result = validateCourseForPublish(validCourse, validStructure);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test("fails when the course has no title", () => {
    const result = validateCourseForPublish({ ...validCourse, title: "" }, validStructure);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.key)).toContain("lms.errors.courseTitleRequired");
  });

  test("fails when there are no sections", () => {
    const result = validateCourseForPublish(validCourse, { sections: [], courseAssessments: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.key)).toContain("lms.errors.noSections");
  });

  test("fails when there are no lessons", () => {
    const result = validateCourseForPublish(validCourse, {
      sections: [{ id: "S-1", title: "Intro", lessons: [], assessment: null }],
      courseAssessments: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.key)).toContain("lms.errors.noLessons");
  });

  test("fails when a section has no title", () => {
    const result = validateCourseForPublish(validCourse, {
      sections: [{ ...validStructure.sections[0], title: "" }],
      courseAssessments: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.key)).toContain("lms.errors.sectionTitleRequired");
  });

  test("fails when a lesson has no title", () => {
    const result = validateCourseForPublish(validCourse, {
      sections: [
        {
          ...validStructure.sections[0],
          lessons: [{ ...validStructure.sections[0].lessons[0], title: "" }],
        },
      ],
      courseAssessments: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.key)).toContain("lms.errors.lessonTitleRequired");
  });

  test("fails when a video lesson has no valid YouTube reference", () => {
    const result = validateCourseForPublish(validCourse, {
      sections: [
        {
          ...validStructure.sections[0],
          lessons: [
            { ...validStructure.sections[0].lessons[0], youtube_video_id: "short" },
          ],
        },
      ],
      courseAssessments: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.key)).toContain("lms.errors.lessonVideoRequired");
  });

  test("a course without assessments still validates", () => {
    const result = validateCourseForPublish(validCourse, validStructure);
    expect(result.valid).toBe(true);
  });

  test("fails when a section assessment has no questions", () => {
    const result = validateCourseForPublish(validCourse, {
      sections: [
        {
          ...validStructure.sections[0],
          assessment: { id: "A-1", title: "Intro Quiz", questions: [] },
        },
      ],
      courseAssessments: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.key)).toContain("lms.errors.assessmentQuestionsRequired");
  });

  test("fails when a multiple-choice question has fewer than two options", () => {
    const result = validateCourseForPublish(validCourse, {
      sections: [
        {
          ...validStructure.sections[0],
          assessment: {
            id: "A-1",
            title: "Intro Quiz",
            questions: [
              {
                id: "Q-1",
                question: "Pick one",
                question_type: "multiple_choice",
                options: [{ key: "A", text: "Only option" }],
                correct_answer: ["A"],
              },
            ],
          },
        },
      ],
      courseAssessments: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.key)).toContain("lms.errors.mcOptionsRequired");
  });

  test("fails when a multiple-choice question has no correct answer", () => {
    const result = validateCourseForPublish(validCourse, {
      sections: [
        {
          ...validStructure.sections[0],
          assessment: {
            id: "A-1",
            title: "Intro Quiz",
            questions: [
              {
                id: "Q-1",
                question: "Pick one",
                question_type: "multiple_choice",
                options: [
                  { key: "A", text: "One" },
                  { key: "B", text: "Two" },
                ],
                correct_answer: [],
              },
            ],
          },
        },
      ],
      courseAssessments: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.key)).toContain("lms.errors.correctAnswerRequired");
  });

  test("fails when a true/false question has no correct answer", () => {
    const result = validateCourseForPublish(validCourse, {
      sections: [
        {
          ...validStructure.sections[0],
          assessment: {
            id: "A-1",
            title: "Intro Quiz",
            questions: [
              {
                id: "Q-1",
                question: "True or false?",
                question_type: "true_false",
                correct_answer: [],
              },
            ],
          },
        },
      ],
      courseAssessments: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.key)).toContain("lms.errors.correctAnswerRequired");
  });

  test("validates course-level assessments too", () => {
    const result = validateCourseForPublish(validCourse, {
      sections: validStructure.sections,
      courseAssessments: [
        {
          id: "A-2",
          title: "",
          questions: [
            {
              id: "Q-2",
              question: "True or false?",
              question_type: "true_false",
              correct_answer: ["true"],
            },
          ],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.key)).toContain("lms.errors.assessmentTitleRequired");
  });

  test("fails when pass mark is out of range", () => {
    const result = validateCourseForPublish(validCourse, {
      sections: [
        {
          ...validStructure.sections[0],
          assessment: {
            id: "A-1",
            title: "Intro Quiz",
            pass_mark: 101,
            questions: [
              {
                id: "Q-1",
                question: "Pick one",
                question_type: "multiple_choice",
                options: [
                  { key: "A", text: "One" },
                  { key: "B", text: "Two" },
                ],
                correct_answer: ["A"],
              },
            ],
          },
        },
      ],
      courseAssessments: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.key)).toContain("lms.errors.invalidPassMark");
  });
});
