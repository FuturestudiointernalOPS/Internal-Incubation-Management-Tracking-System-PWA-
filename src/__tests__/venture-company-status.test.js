/**
 * Unit tests — the Venture COMPANY status vocabulary (Vinance Phase 0).
 *
 * `ventures.status` held a company state nobody had pinned down: the admin list,
 * the founder screen and the original DDL each knew a different set. This file
 * guards the one source of truth (`src/lib/ventureCompanyStatus.js`) that the
 * surfaces now read, so a legal state can never quietly change again.
 */

const {
  VENTURE_COMPANY_STATUSES,
  VENTURE_COMPANY_STATUS_DEFAULT,
  LEGACY_COMPANY_STATUSES,
  normalizeCompanyStatus,
  companyStatusWord,
  companyStatusLabel,
  companyStatusOptions,
} = require("@/lib/ventureCompanyStatus");

const t = (key) => ({ "status.active": "Active", "status.paused": "Paused" }[key] || key);

describe("ventureCompanyStatus — vocabulary", () => {
  test("the legal states are the company lifecycle, in order", () => {
    expect(VENTURE_COMPANY_STATUSES).toEqual([
      "prospect",
      "active",
      "paused",
      "graduated",
      "archived",
    ]);
  });

  test("the default matches the column default", () => {
    expect(VENTURE_COMPANY_STATUS_DEFAULT).toBe("active");
  });

  test("the only legacy value is pending, and it means prospect", () => {
    expect(LEGACY_COMPANY_STATUSES).toEqual({ pending: "prospect" });
  });
});

describe("ventureCompanyStatus — normalization", () => {
  test("a canonical value is returned as-is (trimmed, lowercased)", () => {
    expect(normalizeCompanyStatus("active")).toBe("active");
    expect(normalizeCompanyStatus("  Graduated ")).toBe("graduated");
  });

  test("a legacy value maps to the state it now means", () => {
    expect(normalizeCompanyStatus("pending")).toBe("prospect");
  });

  test("an unknown or empty value is null — never a guessed state", () => {
    expect(normalizeCompanyStatus("weird")).toBeNull();
    expect(normalizeCompanyStatus("")).toBeNull();
    expect(normalizeCompanyStatus(null)).toBeNull();
  });
});

describe("ventureCompanyStatus — words and labels", () => {
  test("a known state resolves its shared status.* key and tone", () => {
    expect(companyStatusWord("active")).toEqual({
      id: "active",
      key: "status.active",
      tone: "active",
      raw: null,
    });
  });

  test("an unknown state keeps its raw value visible instead of a guessed word", () => {
    expect(companyStatusWord("weird")).toEqual({
      id: "unknown",
      key: null,
      tone: "unknown",
      raw: "weird",
    });
  });

  test("the label is translated when the key exists, otherwise the raw value", () => {
    expect(companyStatusLabel("paused", t)).toBe("Paused");
    expect(companyStatusLabel("weird", t)).toBe("weird");
  });

  test("options are the vocabulary, in order, already labelled", () => {
    expect(companyStatusOptions(t)).toEqual([
      { value: "prospect", label: "status.prospect" },
      { value: "active", label: "Active" },
      { value: "paused", label: "Paused" },
      { value: "graduated", label: "status.graduated" },
      { value: "archived", label: "status.archived" },
    ]);
  });
});
