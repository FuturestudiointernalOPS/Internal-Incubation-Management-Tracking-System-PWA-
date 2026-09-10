/**
 * PHASE UI-3a — Governance & Audit contracts.
 *
 * Locks the fixes this phase is about:
 *   1. No hardcoded hex colors in the redesigned views (design-system rule:
 *      colors come from CSS variables or the status palette).
 *   2. The audit reason is surfaced as its own field — parsed from the stored
 *      details, never invented.
 *   3. The shared primitives are actually used (StatCard / Badge / WhyDrawer).
 */

const fs = require("fs");
const path = require("path");

const { splitAuditReason } = require("@/components/permissions/auditHelpers");

const EN = require("@/locales/en/engineering.json");
const FR = require("@/locales/fr/engineering.json");

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const resolveKey = (bundle, dotted) =>
  dotted.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), bundle);

describe("UI-3a — audit reason parsing", () => {
  test("splits a recorded reason away from the change sentence", () => {
    expect(
      splitAuditReason("Updated access profile: Program Manager Reason: pilot grants"),
    ).toEqual({ text: "Updated access profile: Program Manager", reason: "pilot grants" });
  });

  test("entries without a reason keep the full text and no reason field", () => {
    expect(splitAuditReason("Deleted access profile with 0 users still assigned")).toEqual({
      text: "Deleted access profile with 0 users still assigned",
      reason: "",
    });
  });

  test("handles missing details without throwing", () => {
    expect(splitAuditReason(null)).toEqual({ text: "", reason: "" });
    expect(splitAuditReason(undefined)).toEqual({ text: "", reason: "" });
  });
});

describe("UI-3a — design-system fixes", () => {
  const center = "src/components/permissions/PermissionCenter.js";

  test("the governance stat cards no longer use hardcoded hex colors", () => {
    const src = read(center);
    for (const hex of ["#10B981", "#F59E0B", "#EF4444", "#94A3B8"]) {
      expect(src).not.toContain(hex);
    }
    expect(src).toContain("StatCard");
  });

  test("the audit detail uses the shared drawer and highlights the reason", () => {
    const src = read(center);
    expect(src).toContain("WhyDrawer");
    expect(src).toContain("splitAuditReason");
    expect(src).toContain("auditReason");
  });

  test("StatCard exposes the denied tone used by the expired state", () => {
    const src = read("src/components/permissions/ui/StatCard.js");
    expect(src).toContain("denied:");
  });

  test("every new label exists in English and French", () => {
    for (const key of [
      "engineering.permissions.auditReason",
      "engineering.permissions.auditDetailTitle",
      "engineering.permissions.auditDetails",
    ]) {
      expect(typeof resolveKey(EN, key)).toBe("string");
      expect(typeof resolveKey(FR, key)).toBe("string");
    }
  });
});
