/**
 * Lot 4, step 4.1 — the action registry.
 *
 * Every API action is one of three DECLARED kinds:
 *
 *   capability — calls a decision mechanism (capability and/or perimeter);
 *   self       — open to any connected user, scoped to the caller's own data;
 *   open       — public by design, secret-guarded, a hub or a documented stub.
 *
 * Everything else is DEBT, frozen in `actionDebt.js`. These tests make the debt
 * ratchet-only: a route added without a declaration fails, and a route that
 * gains one must be removed from the list in the same change.
 */

const fs = require("node:fs");
const path = require("node:path");

const { collectMetrics } = require("../../scripts/lib/authzMetrics");
const {
  SELF_SCOPED_ROUTES,
  OPEN_ASSUMED_ROUTES,
  DELEGATED_DECISIONS,
  SELF_SCOPED_PREFIXES,
  OPEN_ASSUMED_KINDS,
  ROUTE_HUBS,
  NO_GUARD_ALLOWED,
  DECLARED_ACTION_KINDS,
} = require("@/services/authorization/actionDeclarations");
const { UNDECLARED_ACTIONS } = require("@/services/authorization/actionDebt");

const ROOT = path.join(__dirname, "..", "..");
const exists = (file) => fs.existsSync(path.join(ROOT, file));

/** The live scan, using the SAME classification as the metrics dashboard. */
function liveUndeclared() {
  const metrics = collectMetrics();
  return metrics.routes.withoutCapabilityList
    .filter(
      (entry) =>
        entry.category === "a_proteger" ||
        entry.category === "a_verifier_decision_deleguee",
    )
    .map((entry) => entry.file)
    .sort();
}

describe("the action registry", () => {
  test("the declared kinds are the only vocabulary", () => {
    expect([...DECLARED_ACTION_KINDS].sort()).toEqual([
      "capability",
      "delegated",
      "open",
      "self",
    ]);
  });

  test("every delegated declaration names its service and its rule", () => {
    for (const entry of DELEGATED_DECISIONS) {
      expect(entry.file).toMatch(/^src\/app\/api\/.*route\.js$/);
      expect(entry.service).toMatch(/^src\/services\/.*\.js$/);
      expect(typeof entry.rule).toBe("string");
      expect(entry.rule.length).toBeGreaterThan(3);
      expect(typeof entry.reason).toBe("string");
      expect(entry.reason.length).toBeGreaterThan(10);
    }
  });

  test("every self-scoped declaration names a scope and a reason", () => {
    for (const entry of SELF_SCOPED_ROUTES) {
      expect(entry.file).toMatch(/^src\/app\/api\/.*route\.js$/);
      expect(Array.isArray(entry.methods) && entry.methods.length > 0).toBe(true);
      expect(entry.scope).toBe("session.cid");
      expect(typeof entry.reason).toBe("string");
      expect(entry.reason.length).toBeGreaterThan(10);
    }
  });

  test("every open declaration names a known kind and a reason", () => {
    for (const entry of OPEN_ASSUMED_ROUTES) {
      expect(entry.file).toMatch(/^src\/app\/api\/.*route\.js$/);
      expect(OPEN_ASSUMED_KINDS).toContain(entry.kind);
      expect(typeof entry.reason).toBe("string");
      expect(entry.reason.length).toBeGreaterThan(10);
    }
  });

  test("no action is declared under two kinds", () => {
    const declared = [
      ...SELF_SCOPED_ROUTES.map((entry) => entry.file),
      ...OPEN_ASSUMED_ROUTES.map((entry) => entry.file),
      ...DELEGATED_DECISIONS.map((entry) => entry.file),
      ...ROUTE_HUBS,
      ...NO_GUARD_ALLOWED,
    ];
    const seen = new Set();
    const duplicates = [];
    for (const file of declared) {
      if (seen.has(file)) duplicates.push(file);
      seen.add(file);
    }
    expect(duplicates).toEqual([]);
  });

  test("every declared action still exists on disk", () => {
    const declared = [
      ...SELF_SCOPED_ROUTES.map((entry) => entry.file),
      ...OPEN_ASSUMED_ROUTES.map((entry) => entry.file),
      ...DELEGATED_DECISIONS.map((entry) => entry.file),
      ...ROUTE_HUBS,
      ...NO_GUARD_ALLOWED,
    ];
    expect(declared.filter((file) => !exists(file))).toEqual([]);
  });

  test("self-scoped prefixes stay explicit (no silent prefix growth)", () => {
    expect([...SELF_SCOPED_PREFIXES].sort()).toEqual([
      "src/app/api/me/",
      "src/app/api/profile/",
    ]);
  });
});

describe("the action debt is a ratchet", () => {
  test("no action is undeclared beyond the frozen list", () => {
    const delegated = new Set(DELEGATED_DECISIONS.map((entry) => entry.file));
    const frozen = UNDECLARED_ACTIONS.map((entry) => entry.file).sort();
    expect(liveUndeclared().filter((file) => !delegated.has(file))).toEqual(frozen);
  });

  test("the frozen list only contains the two debt categories", () => {
    for (const entry of UNDECLARED_ACTIONS) {
      expect(["a_proteger", "a_verifier_decision_deleguee"]).toContain(entry.category);
    }
  });

  test("an action is never both declared and in debt", () => {
    const declared = new Set([
      ...SELF_SCOPED_ROUTES.map((entry) => entry.file),
      ...OPEN_ASSUMED_ROUTES.map((entry) => entry.file),
      ...DELEGATED_DECISIONS.map((entry) => entry.file),
      ...ROUTE_HUBS,
      ...NO_GUARD_ALLOWED,
    ]);
    expect(UNDECLARED_ACTIONS.filter((entry) => declared.has(entry.file))).toEqual([]);
  });
});
