/**
 * Phase 9 — FINAL AUTHORIZATION MODEL consistency tests.
 *
 * These lock in the invariants the model must keep:
 *   - every role referenced by API route gates exists in the role catalog
 *   - login identity resolution never surfaces legacy/normalized-away roles
 *   - the platform role set and the eligibility defaults stay aligned
 *
 * The behavioral layers (eligibility ≠ access, restriction > grant, SA
 * bypass, context scoping) are covered by authorization-resolver,
 * membership, and context-access suites — this file guards the model itself.
 */

const { readFileSync, readdirSync, statSync } = require("fs");
const { join } = require("path");
const { ROLE_CATALOG } = require("@/lib/authorization/eligibility-admin");
const { FEATURE_ELIGIBILITY_DEFAULTS } = require("@/lib/authorization/eligibility");
const { resolveEffectiveRole, INTERNAL_GROUP } = require("@/lib/platform/roles");

const API_ROOT = join(__dirname, "..", "app", "api");
const walk = (dir) => {
  let out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (entry === "route.js") out.push(p);
  }
  return out;
};

/** Every role literal referenced by role-list gates across the API surface. */
function gateRoles() {
  const roles = new Set();
  for (const f of walk(API_ROOT)) {
    const src = readFileSync(f, "utf-8");
    for (const m of src.matchAll(/roles:\s*\[([^\]]*)\]/g)) {
      for (const r of m[1].split(",").map((x) => x.trim().replace(/["']/g, "")).filter(Boolean)) roles.add(r);
    }
    for (const m of src.matchAll(/requireAuth\(\s*\[([^\]]*)\]/g)) {
      for (const r of m[1].split(",").map((x) => x.trim().replace(/["']/g, "")).filter(Boolean)) roles.add(r);
    }
  }
  return roles;
}

describe("Phase 9 — model consistency", () => {
  test("every role used in API route gates exists in ROLE_CATALOG", () => {
    const uncataloged = [...gateRoles()].filter((r) => !ROLE_CATALOG.includes(r));
    expect(uncataloged).toEqual([]);
  });

  test("every role in the eligibility defaults exists in ROLE_CATALOG", () => {
    const defaults = new Set(Object.values(FEATURE_ELIGIBILITY_DEFAULTS).flat());
    const missing = [...defaults].filter((r) => !ROLE_CATALOG.includes(r));
    expect(missing).toEqual([]);
  });

  test("login identity resolution never surfaces normalized-away roles", () => {
    // admin / project_manager normalize to staff — no session may carry them.
    for (const legacy of ["admin", "project_manager"]) {
      expect(resolveEffectiveRole({ role: legacy })).toBe("staff");
      expect(resolveEffectiveRole({ role: legacy, groups: [INTERNAL_GROUP] })).toBe("staff");
    }
  });

  test("legacy 'admin' gate entries are unreachable (documented dead code)", () => {
    // resolveEffectiveRole normalizes admin → staff at login, so an "admin"
    // session never exists; gates listing admin are harmless but dead.
    const roles = gateRoles();
    expect(roles.has("admin")).toBe(true);
    expect(resolveEffectiveRole({ role: "admin" })).not.toBe("admin");
  });

  test("gate census matches the known inventory (no surprise roles)", () => {
    const roles = [...gateRoles()].sort();
    expect(roles).toEqual(
      [
        "admin",
        "developer",
        "facilitator",
        "founder",
        "investor",
        "participant",
        "program_manager",
        "security_officer",
        "staff",
        "super_admin",
        "teacher",
        "team",
      ].sort(),
    );
  });

  test("eligibility UI identities are the agreed matrix columns and stay within ROLE_CATALOG", () => {
    const { ELIGIBILITY_IDENTITIES } = require("@/lib/authorization/eligibility-admin");
    expect(ELIGIBILITY_IDENTITIES).toEqual([
      "super_admin",
      "staff",
      "member",
      "participant",
      "facilitator",
      "investor",
    ]);
    // Every UI identity must exist in the technical catalog (gate validation
    // and legacy lookups keep working); functions are intentionally excluded.
    for (const ident of ELIGIBILITY_IDENTITIES) {
      expect(ROLE_CATALOG).toContain(ident);
    }
  });
});
