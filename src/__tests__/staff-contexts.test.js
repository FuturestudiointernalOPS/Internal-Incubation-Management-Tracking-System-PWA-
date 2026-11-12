/**
 * The staff contexts — what makes each one true.
 *
 * The navigation hook used to test these conditions inline. It asks this module
 * now, so "lead manager" and "programme manager" mean the same thing in the
 * sidebar and in any future screen.
 */

const {
  STAFF_CONTEXTS,
  activeStaffContexts,
  hasStaffContext,
} = require("@/spaces/staff/contexts");

describe("which staff contexts are active", () => {
  test("every staff account has the core context", () => {
    expect(activeStaffContexts({ role: "staff" }).map((c) => c.key)).toEqual([
      "core",
    ]);
  });

  test("a venture assignment opens the lead-manager context", () => {
    expect(
      hasStaffContext(
        { role: "staff", ventureAssignCount: 2 },
        "lead-manager",
      ),
    ).toBe(true);
    expect(
      hasStaffContext(
        { role: "staff", ventureAssignCount: 0 },
        "lead-manager",
      ),
    ).toBe(false);
  });

  test("an unknown assignment count does not open it", () => {
    expect(
      hasStaffContext(
        { role: "staff", ventureAssignCount: null },
        "lead-manager",
      ),
    ).toBe(false);
    expect(
      hasStaffContext({ role: "staff" }, "lead-manager"),
    ).toBe(false);
  });

  test("a non-staff identity never gets the staff lead-manager context", () => {
    expect(
      hasStaffContext(
        { role: "member", ventureAssignCount: 3 },
        "lead-manager",
      ),
    ).toBe(false);
  });

  test("a legacy programme-manager badge also opens it", () => {
    expect(
      hasStaffContext(
        { role: "program_manager", ventureAssignCount: 1 },
        "lead-manager",
      ),
    ).toBe(true);
  });

  test("managed programmes open the program-manager context", () => {
    expect(
      hasStaffContext({ pmPrograms: [{ id: 1 }] }, "program-manager"),
    ).toBe(true);
    expect(hasStaffContext({ pmPrograms: [] }, "program-manager")).toBe(false);
  });

  test("an undefined programme list is treated as none", () => {
    expect(hasStaffContext({}, "program-manager")).toBe(false);
  });

  test("every context declares a translation key", () => {
    for (const context of STAFF_CONTEXTS) {
      expect(typeof context.labelKey).toBe("string");
      expect(typeof context.when).toBe("function");
    }
  });
});
