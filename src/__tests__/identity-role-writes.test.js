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

/** Files containing a direct `UPDATE contacts SET ... role` statement. */
function findRoleMutationFiles() {
  const hits = [];
  for (const root of SRC_DIRS) {
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(js|mjs)$/.test(entry.name)) {
          const src = fs.readFileSync(full, "utf8");
          if (/UPDATE\s+contacts\s+SET[\s\S]{0,120}role/.test(src)) {
            hits.push(full.replace(/\\/g, "/"));
          }
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
