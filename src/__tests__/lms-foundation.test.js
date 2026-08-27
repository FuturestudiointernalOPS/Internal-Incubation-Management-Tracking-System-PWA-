/**
 * LMS FOUNDATION — Phase 1 verification tests (static, no live DB required).
 *
 * The repo's existing tests mock the DB layer; these follow the same approach.
 * This suite grows with the LMS: each phase adds its describe block here
 * (migration → authorization → services → API routes → learner experience).
 *
 * Phase 1 coverage:
 *   - the LMS migration file creates exactly the approved Phase 1 entities
 *     with the required constraints (uniqueness, FKs, CHECK enums, indexes);
 *   - certificates are intentionally deferred in Phase 1;
 *   - the migration is purely additive (no ALTER/DROP on existing tables);
 *   - the `lms` permission module is registered in PERMISSION_MODULES;
 *   - the JS domain constants in src/lib/lms/ match the migration's CHECK
 *     values (drift guard).
 */

const fs = require("fs");
const path = require("path");

jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn().mockResolvedValue({ rows: [] }) },
  initDb: jest.fn().mockResolvedValue(true),
}));

const { PERMISSION_MODULES } = require("@/lib/auth");
const LMS = require("@/lib/lms");

const MIGRATION_PATH = path.join(
  __dirname,
  "../../supabase/migrations/20260827_lms_foundation.sql",
);
const migration = fs.readFileSync(MIGRATION_PATH, "utf8");

/** Extract the body of a CREATE TABLE block by table name. */
function tableBlock(table) {
  const re = new RegExp(
    `CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\);`,
  );
  const m = migration.match(re);
  return m ? m[1] : "";
}

const PHASE1_TABLES = [
  "lms_courses",
  "lms_course_sections",
  "lms_lessons",
  "lms_enrollments",
  "lms_lesson_progress",
  "lms_assessments",
  "lms_assessment_questions",
  "lms_assessment_attempts",
  "lms_program_requirements",
];

describe("LMS migration — entity coverage", () => {
  test.each(PHASE1_TABLES)("creates %s", (table) => {
    expect(migration).toMatch(
      new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(`),
    );
  });

  test("does not create certificate entities in Phase 1 (deferred)", () => {
    expect(migration).not.toMatch(/lms_certificates/);
  });

  test("is purely additive — no ALTER/DROP on existing tables", () => {
    expect(migration).not.toMatch(/\bALTER TABLE\b/);
    expect(migration).not.toMatch(/\bDROP TABLE\b/);
  });
});

describe("LMS migration — constraints", () => {
  test("courses: status lifecycle, slug, created_by", () => {
    const b = tableBlock("lms_courses");
    expect(b).toMatch(/slug TEXT UNIQUE/);
    expect(b).toMatch(/CHECK \(status IN \('draft', 'published', 'archived'\)\)/);
    expect(b).toMatch(/created_by TEXT/);
  });

  test("sections: cascade from course, unique ordering", () => {
    const b = tableBlock("lms_course_sections");
    expect(b).toMatch(
      /course_id UUID NOT NULL REFERENCES lms_courses\(id\) ON DELETE CASCADE/,
    );
    expect(b).toMatch(/UNIQUE \(course_id, position\)/);
  });

  test("lessons: YouTube id, video-only content type, unique ordering", () => {
    const b = tableBlock("lms_lessons");
    expect(b).toMatch(
      /section_id UUID NOT NULL REFERENCES lms_course_sections\(id\) ON DELETE CASCADE/,
    );
    expect(b).toMatch(/youtube_video_id TEXT/);
    expect(b).toMatch(/CHECK \(content_type IN \('video'\)\)/);
    expect(b).toMatch(/UNIQUE \(section_id, position\)/);
  });

  test("enrollments: one per learner+course, source enum, existing identity", () => {
    const b = tableBlock("lms_enrollments");
    expect(b).toMatch(/user_cid TEXT NOT NULL REFERENCES contacts\(cid\) ON DELETE CASCADE/);
    expect(b).toMatch(/CHECK \(source IN \('admin', 'program', 'self', 'purchase'\)\)/);
    expect(b).toMatch(/UNIQUE \(course_id, user_cid\)/);
  });

  test("lesson progress: unique per enrollment+lesson, status enum", () => {
    const b = tableBlock("lms_lesson_progress");
    expect(b).toMatch(
      /enrollment_id UUID NOT NULL REFERENCES lms_enrollments\(id\) ON DELETE CASCADE/,
    );
    expect(b).toMatch(
      /lesson_id UUID NOT NULL REFERENCES lms_lessons\(id\) ON DELETE CASCADE/,
    );
    expect(b).toMatch(/CHECK \(status IN \('not_started', 'in_progress', 'completed'\)\)/);
    expect(b).toMatch(/UNIQUE \(enrollment_id, lesson_id\)/);
  });

  test("assessments: optional section anchor", () => {
    const b = tableBlock("lms_assessments");
    expect(b).toMatch(/course_id UUID NOT NULL REFERENCES lms_courses\(id\) ON DELETE CASCADE/);
    expect(b).toMatch(/section_id UUID REFERENCES lms_course_sections\(id\) ON DELETE CASCADE/);
  });

  test("questions: MC + true/false, JSONB options/answers, unique ordering", () => {
    const b = tableBlock("lms_assessment_questions");
    expect(b).toMatch(/CHECK \(question_type IN \('multiple_choice', 'true_false'\)\)/);
    expect(b).toMatch(/options JSONB NOT NULL DEFAULT '\[\]'::jsonb/);
    expect(b).toMatch(/correct_answer JSONB NOT NULL DEFAULT '\[\]'::jsonb/);
    expect(b).toMatch(/UNIQUE \(assessment_id, position\)/);
  });

  test("attempts: multiple attempts structurally supported", () => {
    const b = tableBlock("lms_assessment_attempts");
    expect(b).toMatch(/UNIQUE \(user_cid, assessment_id, attempt_number\)/);
    expect(b).not.toMatch(/UNIQUE \(user_cid, assessment_id\)/);
    expect(b).toMatch(/passed BOOLEAN NOT NULL DEFAULT FALSE/);
    expect(b).toMatch(/score INTEGER NOT NULL DEFAULT 0/);
    expect(b).toMatch(/total_points INTEGER NOT NULL DEFAULT 0/);
  });

  test("program requirements: program→course link", () => {
    const b = tableBlock("lms_program_requirements");
    expect(b).toMatch(/program_id TEXT NOT NULL/);
    expect(b).toMatch(/course_id UUID NOT NULL REFERENCES lms_courses\(id\) ON DELETE CASCADE/);
    expect(b).toMatch(/UNIQUE \(program_id, course_id\)/);
    expect(b).toMatch(/is_required BOOLEAN NOT NULL DEFAULT TRUE/);
  });
});

describe("LMS migration — indexes", () => {
  test("enrollment user lookup is indexed", () => {
    expect(migration).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_lms_enrollments_user ON lms_enrollments\(user_cid\)/,
    );
  });

  test("lesson progress lesson lookup is indexed", () => {
    expect(migration).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_lms_lesson_progress_lesson ON lms_lesson_progress\(lesson_id\)/,
    );
  });

  test("assessment course + section lookups are indexed", () => {
    expect(migration).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_lms_assessments_course ON lms_assessments\(course_id\)/,
    );
    expect(migration).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_lms_assessments_section ON lms_assessments\(section_id\)/,
    );
  });

  test("attempts assessment lookup is indexed", () => {
    expect(migration).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_lms_attempts_assessment ON lms_assessment_attempts\(assessment_id\)/,
    );
  });

  test("program requirements course lookup is indexed", () => {
    expect(migration).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_lms_program_requirements_course ON lms_program_requirements\(course_id\)/,
    );
  });
});

describe("LMS permission registration", () => {
  test("registers an lms module in PERMISSION_MODULES", () => {
    expect(PERMISSION_MODULES.lms).toBeDefined();
    expect(PERMISSION_MODULES.lms.name).toBe("LMS");
  });

  test("exposes the planned capabilities without inventing a new role", () => {
    expect(PERMISSION_MODULES.lms.capabilities).toEqual(
      expect.arrayContaining([
        "view",
        "create",
        "edit",
        "delete",
        "publish",
        "enroll",
      ]),
    );
  });
});

describe("LMS domain constants vs migration enums (drift guard)", () => {
  test.each([
    [LMS.LMS_COURSE_STATUSES, "lms_courses"],
    [LMS.LMS_COURSE_VISIBILITY, "lms_courses"],
    [LMS.LMS_ENROLLMENT_SOURCES, "lms_enrollments"],
    [LMS.LMS_ENROLLMENT_STATUSES, "lms_enrollments"],
    [LMS.LMS_PROGRESS_STATUSES, "lms_lesson_progress"],
    [LMS.LMS_LESSON_CONTENT_TYPES, "lms_lessons"],
    [LMS.LMS_QUESTION_TYPES, "lms_assessment_questions"],
  ])("%j matches the CHECK values in %s", (values, table) => {
    const block = tableBlock(table);
    for (const v of values) expect(block).toContain(`'${v}'`);
  });
});
