/**
 * COUNTRY FIELD — the display helper, the country catalogue and the builder
 * registration.
 *
 * The stored answer is the ISO alpha-2 code; every surface that shows it must
 * turn it into the flag + readable name. A legacy free-text answer (or a value
 * that is not a country code) must survive unchanged rather than disappear.
 */

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { execute: jest.fn(async () => ({ rows: [] })) },
}));

const db = require("@/lib/db").default;
const { formatCountryAnswer } = require("@/lib/countries");
const { getCountries } = require("@/lib/profile-options");
const { FIELD_TYPES, FIELD_TYPE_KEYS, FIELD_ICONS } = require("@/components/shared/platform/forms/constants");

describe("formatCountryAnswer", () => {
  test("a stored ISO code becomes a flag + name", () => {
    expect(formatCountryAnswer("BJ", "en")).toBe("🇧🇯 Benin");
    expect(formatCountryAnswer("FR", "fr")).toContain("🇫🇷");
    expect(formatCountryAnswer("fr", "fr")).not.toBe("fr");
  });

  test("a legacy free-text answer is left untouched", () => {
    expect(formatCountryAnswer("Benin")).toBe("Benin");
    expect(formatCountryAnswer("Côte d'Ivoire")).toBe("Côte d'Ivoire");
  });

  test("an unknown two-letter value is not given a flag", () => {
    expect(formatCountryAnswer("ZZ")).toBe("ZZ");
  });

  test("empty answers stay empty", () => {
    expect(formatCountryAnswer("")).toBe("");
    expect(formatCountryAnswer(null)).toBe("");
    expect(formatCountryAnswer(undefined)).toBe("");
  });
});

describe("the country catalogue", () => {
  test("offers value/label pairs, sorted, with the country code as the value", () => {
    const countries = getCountries("en");
    expect(countries.length).toBeGreaterThan(200);
    expect(countries.some((country) => country.value === "BJ")).toBe(true);
    expect(countries.find((country) => country.value === "BJ").label).toBe("Benin");
    expect(countries).toEqual([...countries].sort((first, second) => first.label.localeCompare(second.label, "en")));
  });
});

describe("the form builder registration", () => {
  test("country is a single-choice field type with its own label and icon", () => {
    expect(FIELD_TYPES.some((type) => type.value === "country")).toBe(true);
    expect(FIELD_TYPE_KEYS.country).toBe("fieldTypeCountry");
    expect(FIELD_ICONS.country).toBeTruthy();
  });

  test("the stored field-type rule is widened once, with country included", async () => {
    const { ensurePlatformFormFieldTypeSupport } = require("@/models/forms/platform");

    await ensurePlatformFormFieldTypeSupport();
    await ensurePlatformFormFieldTypeSupport();

    expect(db.execute).toHaveBeenCalledTimes(2);
    const statements = db.execute.mock.calls.map(([argument]) => argument.sql);
    expect(statements[0]).toMatch(/DROP CONSTRAINT IF EXISTS platform_form_fields_field_type_check/);
    expect(statements[1]).toMatch(/CHECK \(field_type IN/);
    expect(statements[1]).toMatch(/'country'/);
  });
});
