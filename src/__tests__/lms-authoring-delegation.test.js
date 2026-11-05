/**
 * LMS — delegated course authoring.
 *
 * Course authoring rights (`lms.view` / `create` / `edit`) were only reachable
 * by the platform owner: the LMS feature's role ceiling was super-admin-only, so
 * the Permission Center could not grant `lms.create` to a chosen staff member.
 * This suite locks the delegation contract:
 *
 *   - staff is eligible for the LMS feature (personal accounts are not — the
 *     authoring workspace lives on the staff side);
 *   - any of the three authoring rights opens the LMS section on a reachable
 *     non-admin page;
 *   - the authoring reads accept all three rights, so a creator/editor can open
 *     the workspace;
 *   - the create action lives in the Courses view, gated by `lms.create`;
 *   - the one-time migration writes the staff ceiling for existing databases.
 */

const fs = require("node:fs");
const path = require("node:path");

const {
  FEATURE_ELIGIBILITY_DEFAULTS,
} = require("@/models/authorization/constants/eligibility-defaults");
const {
  NAV_CAPABILITY_REQUIREMENTS,
  requirementAlternatives,
  buildAccessNav,
} = require("@/lib/masterNavigation");

const ROOT = path.join(__dirname, "..", "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("LMS course authoring is delegable", () => {
  test("staff is eligible for the LMS feature; personal accounts are not", () => {
    // ELIGIBLE ≠ GRANTED: the ceiling only lets an administrator hand the right out.
    expect(FEATURE_ELIGIBILITY_DEFAULTS.lms).toContain("staff");
    expect(FEATURE_ELIGIBILITY_DEFAULTS.lms).not.toContain("member");
  });

  test("any authoring right opens the LMS section on the non-admin courses page", () => {
    for (const capability of ["view", "create", "edit"]) {
      const nav = buildAccessNav("staff", { lms: { [capability]: 1 } });
      const section = nav.find((item) => item.id === "lms");
      expect(section).toBeDefined();
      const courses = section.subItems.find((item) => item.id === "lms_courses");
      expect(courses).toBeDefined();
      expect(courses.href).toBe("/pm/lms/courses");
      expect(courses.href.startsWith("/admin")).toBe(false);
    }
    // The section opens for any of the three, never only for `view`.
    const alternatives = requirementAlternatives(NAV_CAPABILITY_REQUIREMENTS.lms);
    expect(alternatives.map((entry) => entry.capability).sort()).toEqual([
      "create",
      "edit",
      "view",
    ]);
  });

  test("the course reads accept every authoring right", () => {
    for (const file of [
      "src/app/api/lms/courses/route.js",
      "src/app/api/lms/courses/[id]/route.js",
    ]) {
      const src = read(file);
      expect(src).toMatch(/requireAnyAuthorization\(/);
      for (const capability of ["view", "create", "edit"]) {
        expect(src).toMatch(
          new RegExp(`module: "lms", capability: "${capability}"`),
        );
      }
    }
  });

  test("the create action lives in the Courses view, gated by lms.create", () => {
    const src = read("src/components/lms/CourseList.js");
    expect(src).toMatch(/can\("lms", cap\)/);
    expect(src).toMatch(/allow\("create"\)/);
    expect(src).toContain("${basePath}/new");
  });

  test("the one-time migration writes the staff ceiling", () => {
    const policies = read("src/models/authorization/backfill/policies.js");
    expect(policies).toMatch(/ensureLmsAuthoringDelegation/);
    expect(policies).toMatch(/VALUES \('lms', 'role', 'staff', 1\)/);
    expect(policies).toMatch(/ON CONFLICT[\s\S]{0,80}DO NOTHING/);
    expect(read("src/models/authorization/backfill.js")).toMatch(
      /lms-authoring-delegation-v1/,
    );
  });
});
