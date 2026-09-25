/**
 * @jest-environment jsdom
 *
 * LEARNER COURSE — descriptions, section material and section folding.
 *
 * Locks what a participant actually gets on the two learner surfaces:
 *   - the course overview (LearnerCourse): the course description and each
 *     section's own description/material are ALWAYS visible; only the lesson
 *     list folds, and only the section holding the resume point starts open;
 *   - the lesson player (LearnerPlayer): the course description, the current
 *     section's description and its material are shown, and the sidebar's
 *     section list folds the same way.
 *
 * The data-fetching hook is mocked with the EXACT payload shape the learner API
 * returns (`getLearnerCourse`), so a payload shape drift fails here.
 *
 * i18n resolves without a provider: `t(key)` returns the key itself, so the
 * assertions double as a "this text goes through t()" check.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";

const mockLearnData = {
  course: {
    id: "C-1",
    title: "Customer Discovery",
    description: "<p>Course overview notes</p>",
    thumbnail_url: null,
    status: "published",
  },
  enrollment: { id: "E-1", source: "admin", status: "active" },
  progress: { percent: 0, completedLessons: 0, totalLessons: 2, complete: false },
  continueLesson: { lessonId: "L-1" },
  certificate: null,
  sections: [
    {
      id: "S-1",
      title: "Intro",
      description: "<p>Intro section notes</p>",
      position: 0,
      resources: [
        {
          id: "R-1",
          kind: "document",
          title: "Handout",
          url: "https://example.test/handout.pdf",
          source: "link",
          is_recommended: false,
        },
      ],
      assessment: null,
      progress: { completed: 0, total: 1 },
      lessons: [
        {
          id: "L-1",
          title: "What is discovery",
          description: null,
          position: 0,
          is_required: true,
          duration_minutes: 5,
          youtube_video_id: null,
          state: "current",
        },
      ],
    },
    {
      id: "S-2",
      title: "Interviews",
      description: "<p>Interview notes</p>",
      position: 1,
      resources: [],
      assessment: null,
      progress: { completed: 0, total: 1 },
      lessons: [
        {
          id: "L-2",
          title: "Run an interview",
          description: null,
          position: 0,
          is_required: true,
          duration_minutes: 8,
          youtube_video_id: null,
          state: "not_started",
        },
      ],
    },
  ],
  courseAssessments: [],
};

jest.mock("@/lib/hooks/useApi", () => ({
  useApi: (url) =>
    String(url).includes("coaching")
      ? { data: [], loading: false, error: null, refresh: async () => {} }
      : {
          data: { payload: mockLearnData, failure: null },
          loading: false,
          error: null,
          refresh: async () => {},
        },
  cacheGet: () => null,
  cacheSet: () => {},
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const LearnerCourse = require("@/components/lms/LearnerCourse").default;
const LearnerPlayer = require("@/components/lms/LearnerPlayer").default;

describe("LearnerCourse — description, material and folded sections", () => {
  test("the course description and a section's description/material are always shown", () => {
    render(<LearnerCourse courseId="C-1" />);

    expect(screen.getByText("Course overview notes")).toBeTruthy();
    // Section material stays visible even while its lesson list is folded.
    expect(screen.getByText("Intro section notes")).toBeTruthy();
    expect(screen.getByText("Interview notes")).toBeTruthy();
    expect(screen.getByText("Handout")).toBeTruthy();
  });

  test("only the resume section's lessons start open; the others fold away", () => {
    render(<LearnerCourse courseId="C-1" />);

    // The section holding the resume point is open by default.
    expect(screen.getByText("What is discovery")).toBeTruthy();
    // Every other section's lessons are hidden until asked for.
    expect(screen.queryByText("Run an interview")).toBeNull();

    const interviewsHeader = screen.getByText("Interviews").closest("button");
    expect(interviewsHeader.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(interviewsHeader);
    expect(screen.getByText("Run an interview")).toBeTruthy();
    expect(interviewsHeader.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(interviewsHeader);
    expect(screen.queryByText("Run an interview")).toBeNull();
  });
});

describe("LearnerPlayer — course context and folded sidebar sections", () => {
  test("shows the course description, the current section's notes and its material", () => {
    render(<LearnerPlayer courseId="C-1" lessonId="L-1" />);

    expect(screen.getByText("Course overview notes")).toBeTruthy();
    // The section block carries the section's own description and material.
    expect(screen.getByText("Intro section notes")).toBeTruthy();
    expect(screen.getByText("Handout")).toBeTruthy();
  });

  test("the sidebar folds the section list, keeping the current section open", () => {
    render(<LearnerPlayer courseId="C-1" lessonId="L-1" />);

    const sidebar = screen
      .getByText("lms.player.courseContent", { selector: "p" })
      .closest("div")
      .parentElement;

    // Current section (§1) is open; the other section's lessons are hidden.
    expect(within(sidebar).getByText("What is discovery")).toBeTruthy();
    expect(within(sidebar).queryByText("Run an interview")).toBeNull();

    const interviewsHeader = within(sidebar).getByText("Interviews").closest("button");
    fireEvent.click(interviewsHeader);
    expect(within(sidebar).getByText("Run an interview")).toBeTruthy();
  });
});
