/**
 * PHASE I1 — Identity-rule guard tests (freeze layer).
 *
 * These tests do NOT assert the target model yet (that arrives with the
 * correction). They lock TODAY'S reality so the correction happens
 * consciously, site by site:
 *
 *  1. MUTATION-SITE INVENTORY LOCK — every file that writes contacts.role is
 *     enumerated. Adding/removing a mutation site without updating this test
 *     fails loudly (the I2 "stop the erasing" work must walk this list).
 *  2. BASELINE-PROTECTION GUARD — the existing founder/investor mutations
 *     already protect baseline identities (never clobber staff/SA). That
 *     healthy pattern is locked so it cannot regress.
 *
 * The inverse rule (contexts never mutate the baseline) becomes an assertion
 * in the acceptance suite once I2 flips the writes.
 */
const fs = require("node:fs");
const path = require("node:path");

const SRC_DIRS = ["src/models", "src/lib"];

/** Files that can write contacts.role (direct UPDATE or flag-gated interpolation). */
function findRoleMutationFiles() {
  const hits = [];
  for (const root of SRC_DIRS) {
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(js|mjs)$/.test(entry.name)) {
          const src = fs.readFileSync(full, "utf8");
          if (!/UPDATE\s+contacts\s+SET/.test(src)) continue;
          // I2: role writes are either direct (the UPDATE statement itself
          // names the role column) or flag-gated via the stop-role-mutation
          // helper. Window-free: scope to the statement only.
          const statements = [...src.matchAll(/UPDATE\s+contacts\s+SET[^`;]*/g)];
          const direct = statements.some((m) => /\brole\b/.test(m[0]));
          const gated = src.includes("stopRoleMutationEnabled");
          if (direct || gated) hits.push(full.replace(/\\/g, "/"));
        }
      }
    })(root);
  }
  return hits.sort();
}

test("mutation-site inventory is frozen (every contacts.role write is known)", () => {
  // Enumerate on purpose: these are the ONLY places the global identity is
  // rewritten. I2 converts the contextual ones to membership writes and this
  // list shrinks to the true identity operations (promote/demote).
  const KNOWN_SITES = [
    "src/models/adminOps.js", // approval → participant (contextual — I2 target)
    "src/models/authFlows.js", // v2 invite accept overwrites contact role (contextual — I2 target, no guard!)
    "src/models/authorization.js", // promote/demote super_admin/staff (TRUE identity op — keep)
    "src/models/investorRelations.js", // investor onboarding (contextual — I2 target)
    "src/models/platform/automation.js", // platform approval role set (contextual — I2 target)
    "src/models/venturePipeline.js", // venture founder (contextual — I2 target)
  ];
  expect(findRoleMutationFiles()).toEqual(KNOWN_SITES);
});

test("contextual role mutations protect baseline identities (guards present)", () => {
  const venture = fs.readFileSync("src/models/venturePipeline.js", "utf8");
  const investor = fs.readFileSync("src/models/investorRelations.js", "utf8");
  // Founder write must never clobber super_admin/staff/admin/program_manager.
  expect(venture).toMatch(
    /UPDATE\s+contacts\s+SET\s+role\s*=\s*'founder'[\s\S]{0,200}?role\s+NOT\s+IN\s*\(\s*'super_admin'\s*,\s*'staff'/,
  );
  // Investor write must never clobber super_admin/staff/admin.
  expect(investor).toMatch(
    /UPDATE\s+contacts\s+SET\s+role\s*=\s*'investor'[\s\S]{0,200}?role\s+NOT\s+IN\s*\(\s*'super_admin'\s*,\s*'staff'/,
  );
});

test("identity creation defaults: new platform contacts start as member (baseline)", () => {
  // contactIdentity is the canonical identity resolver — registration and
  // unknown-email resolution must default to `member`, never to a context.
  const identity = fs.readFileSync("src/models/contactIdentity.js", "utf8");
  expect(identity).toMatch(/role\s*=\s*["']member["']/);
  // Form approvals create contacts as member/approved (context arrives later
  // as a membership row, not as the person's global role).
  const formRuns = fs.readFileSync("src/models/formRuns.js", "utf8");
  expect(formRuns).toMatch(/'member'/);
});

test("dynamic contact updaters are watched (never fed contextual roles)", () => {
  // updateContactFields builds SET from caller fields — it is a legitimate
  // admin edit surface, but contextual flows must never pass `role` through
  // it. Watch-list only (no failure today):
  const contacts = fs.readFileSync("src/models/contacts.js", "utf8");
  expect(contacts).toMatch(/export async function updateContactFields/);
});

describe("deriveLegacyRole (I2 transitional view)", () => {
  const { deriveLegacyRole, isBaselineIdentity, BASELINE_IDENTITIES } = require("@/lib/identity");

  test("baseline set is exactly Super Admin / Staff / Member", () => {
    expect([...BASELINE_IDENTITIES].sort()).toEqual(["member", "staff", "super_admin"]);
    expect(isBaselineIdentity("member")).toBe(true);
    expect(isBaselineIdentity("staff")).toBe(true);
    expect(isBaselineIdentity("super_admin")).toBe(true);
    expect(isBaselineIdentity("participant")).toBe(false);
    expect(isBaselineIdentity("founder")).toBe(false);
    expect(isBaselineIdentity("facilitator")).toBe(false);
    expect(isBaselineIdentity("investor")).toBe(false);
  });

  test("member + program membership derives participant", () => {
    expect(deriveLegacyRole({ storedRole: "member", hasActiveParticipantProgram: true })).toBe("participant");
  });

  test("member + venture ownership (no program) derives founder", () => {
    expect(deriveLegacyRole({ storedRole: "member", isActiveVentureOwner: true })).toBe("founder");
  });

  test("bare member stays member", () => {
    expect(deriveLegacyRole({ storedRole: "member" })).toBe("member");
  });

  test("staff and super_admin are never derived", () => {
    expect(deriveLegacyRole({ storedRole: "staff", hasActiveParticipantProgram: true })).toBe("staff");
    expect(deriveLegacyRole({ storedRole: "super_admin", isActiveVentureOwner: true })).toBe("super_admin");
  });

  test("legacy contextual values pass through unchanged (no double-derivation)", () => {
    expect(deriveLegacyRole({ storedRole: "participant" })).toBe("participant");
    expect(deriveLegacyRole({ storedRole: "founder" })).toBe("founder");
    expect(deriveLegacyRole({ storedRole: "investor" })).toBe("investor");
  });
});

describe("I2 mutation-stop guard presence", () => {
  test("every contextual mutation site consults the stop flag", () => {
    const sites = [
      "src/models/adminOps.js",
      "src/models/authFlows.js",
      "src/models/investorRelations.js",
      "src/models/venturePipeline.js",
      "src/models/platform/automation.js",
    ];
    for (const f of sites) {
      const src = fs.readFileSync(f, "utf8");
      expect(src).toContain("stopRoleMutationEnabled");
    }
  });

  test("createSession consults the legacy-role derivation flag", () => {
    const auth = fs.readFileSync("src/lib/auth.js", "utf8");
    expect(auth).toContain("deriveLegacyRoleEnabled()");
  });
});
