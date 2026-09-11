/**
 * Input normalization for venture writes — the bug this guards:
 * a cleared date field arrives as "" and Postgres rejects it in a DATE /
 * TIMESTAMP column, which surfaced as "errors.somethingWrong" (HTTP 500) when
 * editing a milestone or a deliverable.
 */
const fs = require("fs");
const path = require("path");
const { dateOrNull, textOrNull, isUnknownColumnError } = require("@/lib/ventureInput");

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("dateOrNull", () => {
  test("a cleared field becomes NULL, never an empty string", () => {
    expect(dateOrNull("")).toBe(null);
    expect(dateOrNull("   ")).toBe(null);
    expect(dateOrNull(null)).toBe(null);
  });

  test("undefined stays undefined (field not touched)", () => {
    expect(dateOrNull(undefined)).toBeUndefined();
  });

  test("real dates pass through, trimmed to a date", () => {
    expect(dateOrNull("2026-09-15")).toBe("2026-09-15");
    expect(dateOrNull("2026-09-15T10:30:00Z")).toBe("2026-09-15");
    expect(dateOrNull(" 2026-09-15 ")).toBe("2026-09-15");
  });
});

describe("textOrNull", () => {
  test("blank text becomes NULL", () => {
    expect(textOrNull("")).toBe(null);
    expect(textOrNull("  ")).toBe(null);
    expect(textOrNull(null)).toBe(null);
  });

  test("real text is trimmed and kept", () => {
    expect(textOrNull(" MS-1 ")).toBe("MS-1");
  });
});

describe("isUnknownColumnError", () => {
  test("detects schema drift", () => {
    expect(isUnknownColumnError(new Error('column "updated_at" does not exist'))).toBe(true);
  });

  test("does not swallow other database errors", () => {
    expect(isUnknownColumnError(new Error('invalid input syntax for type date: ""'))).toBe(false);
    expect(isUnknownColumnError(new Error("connection terminated"))).toBe(false);
    expect(isUnknownColumnError(null)).toBe(false);
  });
});

describe("the write routes normalize dates (regression)", () => {
  test("milestone PATCH writes NULL for a cleared target_date / start_date", () => {
    const src = read("src/app/api/ventures/[id]/milestones/route.js");
    expect(src).toContain("dateOrNull(target_date)");
    expect(src).toContain("dateOrNull(body.start_date)");
  });

  test("deliverable update writes NULL for a cleared due_date", () => {
    const src = read("src/app/api/ventures/[id]/deliverables/route.js");
    expect(src).toContain("dateOrNull(body[field])");
  });
});
