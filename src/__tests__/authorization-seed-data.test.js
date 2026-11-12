/**
 * The authorization seed data is DATA, not a decision:
 *   - one inert module holds the initial configuration;
 *   - the historic entry points re-export the same objects (no drift);
 *   - the responsibility defaults ARE the eligibility defaults.
 *
 * Locked here so a future change cannot quietly turn the data module into a
 * second decision path.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const SEED_FILE = path.join(ROOT, "src", "models", "authorization", "seedData.js");

describe("authorization seed data — inert and single-sourced", () => {
  test("the data file contains no imports, database access, or logic", () => {
    const source = fs.readFileSync(SEED_FILE, "utf8");
    const code = source
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim();
        return (
          trimmed !== "" &&
          !trimmed.startsWith("//") &&
          !trimmed.startsWith("*") &&
          !trimmed.startsWith("/*")
        );
      })
      .join("\n");

    expect(code).not.toMatch(/^\s*import\b/m);
    expect(code).not.toMatch(/\brequire\s*\(/);
    expect(code).not.toMatch(/@\/lib\/db|db\.execute|client\.query/);
  });

  test("the responsibility defaults are the eligibility defaults", () => {
    const seed = require("@/models/authorization/seedData");
    expect(seed.RESPONSIBILITY_FEATURE_ROLES).toBe(seed.FEATURE_ELIGIBILITY_DEFAULTS);
  });

  test("the historic entry points re-export the same data (no copy)", () => {
    const seed = require("@/models/authorization/seedData");
    const constants = require("@/models/authorization/constants");
    const catalogue = require("@/models/authorization/profileCatalogueSeed");

    expect(constants.FEATURE_ELIGIBILITY_DEFAULTS).toBe(seed.FEATURE_ELIGIBILITY_DEFAULTS);
    expect(constants.FEATURE_ELIGIBILITY_PROFILE_DEFAULTS).toBe(
      seed.FEATURE_ELIGIBILITY_PROFILE_DEFAULTS,
    );
    expect(constants.PROGRAM_ASSIGNMENT_ROWS).toBe(seed.PROGRAM_ASSIGNMENT_ROWS);
    expect(catalogue.PROFILE_CATALOGUE_SEED).toBe(seed.PROFILE_CATALOGUE_SEED);
    expect(catalogue.ROLE_PROFILE_DEFAULTS_SEED).toBe(seed.ROLE_PROFILE_DEFAULTS_SEED);
  });
});
