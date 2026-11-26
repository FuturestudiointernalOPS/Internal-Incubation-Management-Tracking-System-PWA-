/**
 * INVESTOR OPTIONS — one list, two languages.
 *
 * The investor dropdowns used to exist in three places, and two of them
 * disagreed (13 countries in the application seed, 10 in the filters and the
 * profile). This suite locks the correction:
 *
 *   - one source of values (src/lib/investorOptions.js);
 *   - every consumer reads it (filters, profile, application seed);
 *   - every option has a label in BOTH locales, so French loses nothing.
 *
 * Pure: no database, no network, no React.
 */

const fs = require("node:fs");
const path = require("node:path");

const shared = require("@/lib/investorOptions");
const filters = require("@/spaces/member/investor/components/dashboard-page/constants");

const EN = require("@/locales/en/investor.json");
const FR = require("@/locales/fr/investor.json");

const ROOT = path.join(__dirname, "..", "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const resolve = (locale, key) =>
  key.split(".").reduce((node, part) => (node ? node[part] : null), locale);

describe("one list of investor options", () => {
  test("the values and their counts", () => {
    expect(shared.INVESTOR_INDUSTRIES).toHaveLength(10);
    expect(shared.INVESTOR_STAGES).toEqual([
      "Pre-Seed",
      "Seed",
      "Series A",
      "Series B",
      "Growth",
    ]);
    // The union that closes the drift: the application form's 13.
    expect(shared.INVESTOR_COUNTRIES).toHaveLength(13);
    expect(shared.INVESTOR_COUNTRIES).toEqual(
      expect.arrayContaining(["SN", "CI", "CM"]),
    );
    expect(shared.INVESTOR_TYPES).toHaveLength(8);
    expect(shared.INVESTOR_TYPES).toContain("other");
  });

  test("the discovery filters read the same list, not a copy", () => {
    expect(filters.INDUSTRY_OPTIONS).toEqual(shared.INVESTOR_INDUSTRIES);
    expect(filters.COUNTRY_OPTIONS).toEqual(shared.INVESTOR_COUNTRIES);
    expect(filters.STAGE_OPTIONS).toEqual(shared.INVESTOR_STAGES);
  });

  test("the profile page and the application seed use the shared module", () => {
    expect(read("src/app/member/(contexts)/investor/profile/page.js")).toContain(
      'from "@/lib/investorOptions"',
    );
    expect(read("src/services/platform/seed/investorApplication.js")).toContain(
      'from "@/lib/investorOptions"',
    );
  });
});

describe("every option is labelled in English and French", () => {
  const groups = [
    ["industries", shared.INVESTOR_INDUSTRIES],
    ["stages", shared.INVESTOR_STAGES],
    ["countries", shared.INVESTOR_COUNTRIES],
    ["types", shared.INVESTOR_TYPES],
  ];

  test("no missing label in either locale", () => {
    for (const [kind, values] of groups) {
      for (const value of values) {
        const key = shared.investorOptionLabelKey(kind, value);
        expect({ key, lang: "en", label: resolve(EN, key) }).toEqual({
          key,
          lang: "en",
          label: expect.any(String),
        });
        expect({ key, lang: "fr", label: resolve(FR, key) }).toEqual({
          key,
          lang: "fr",
          label: expect.any(String),
        });
      }
    }
  });

  test("the slug is stable and key-safe", () => {
    expect(shared.investorOptionSlug("Pre-Seed")).toBe("pre_seed");
    expect(shared.investorOptionSlug("AI/ML")).toBe("ai_ml");
    expect(shared.investorOptionSlug("E-Commerce")).toBe("e_commerce");
    expect(shared.investorOptionSlug("CD")).toBe("cd");
  });

  test("French really differs where it should", () => {
    expect(resolve(FR, "investorOptions.countries.ci")).toBe("Côte d'Ivoire");
    expect(resolve(FR, "investorOptions.stages.pre_seed")).toBe("Pré-amorçage");
    expect(resolve(FR, "investorOptions.types.angel")).toBe("Business angel");
    expect(resolve(FR, "investorOptions.industries.ai_ml")).toBe("IA/ML");
  });

  test("the raw value is the fallback, never a key name", () => {
    const t = (key) => key; // pretend the key is missing
    expect(shared.investorOptionLabel(t, "countries", "CI")).toBe("CI");
  });
});
