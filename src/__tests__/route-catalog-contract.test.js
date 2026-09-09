/**
 * ROUTE ↔ CATALOG CONSISTENCY CONTRACT (Phase 1)
 *
 * Two directions:
 *  1. Every LITERAL requireAuthorization("module", "capability") in an API
 *     route must resolve to a module + capability that exists in
 *     CAPABILITY_CATALOG. A route guarding on a capability the catalog does
 *     not know about is either a catalog gap (fix the catalog) or dead code
 *     (fix the route).
 *  2. Every catalog capability must be enforced by at least one literal route
 *     guard OR be listed in ALLOWED_UNROUTED (documented UI-only / derived /
 *     locked-module / retired cases). The catalog must not advertise control
 *     nothing enforces.
 *
 * Known limitation: guards built with dynamic module/capability variables are
 * not captured (rare; documented in code review). This test is a floor, not
 * a ceiling.
 */
const fs = require("node:fs");
const path = require("node:path");
const { CAPABILITY_CATALOG } = require("@/models/authorization/capability-catalog");

const API_ROOT = path.join(__dirname, "..", "app", "api");

/** Every requireAuthorization("module","cap") literal used by routes. */
function collectRouteUsages() {
  const usages = new Set();
  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "route.js") files.push(full);
    }
  })(API_ROOT);
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/requireAuthorization\(\s*"([a-z_]+)"\s*,\s*"([a-z_.]+)"/g)) {
      usages.add(`${m[1]}.${m[2]}`);
    }
  }
  return { usages, fileCount: files.length };
}

/**
 * Catalog capabilities with no enforcing literal route, documented as
 * intentional (UI-only / derived / locked-module / kept-for-back-compat).
 * Every entry MUST say why in a comment next to it.
 */
const ALLOWED_UNROUTED = new Set([
  // contacts.import — superseded by the bulk_upload.execute gate (P1). Kept
  // in the catalog so legacy profile rows remain explainable; no route
  // enforces it directly.
  "contacts.import",
  // contacts.export — no export endpoint exists today; cap kept for profile
  // compatibility until an export surface is built (P3 backlog).
  "contacts.export",
  // duplicates.view/resolve — module introduced in P1; routes remain
  // super-admin role-locked until the duplicates module is opened in a later
  // phase (catalog marks it `locked`).
  "duplicates.view",
  "duplicates.resolve",
  // org_membership.view — read surface used by the access summary UI; writes
  // are governed by org_membership.manage (the protected-group boundary).
  "org_membership.view",
  // programs.publish — publishing is enforced through program status
  // transitions/business rules, not a capability guard (P3 backlog).
  "programs.publish",
  // P3 governance backlog — surfaces currently guarded by legacy role
  // allowlists / context checks rather than these catalog capabilities:
  "reports.view",
  "reports.delete",
  "messaging.delete",
  "internal_comms.view",
  "projects.view",
  "projects.archive",
  "finance.edit",
  "finance.delete",
  "finance.export",
  "ventures.view",
  "ventures.create",
  "ventures.delete",
  "investor.delete",
  // users.* + remaining permissions.* — administered through the permissions
  // admin route's dynamic action dispatch / dedicated admin endpoints rather
  // than per-capability literal guards (P3 backlog).
  "users.view",
  "users.create",
  "users.edit",
  "users.suspend",
  "users.delete",
  "users.assign_roles",
  "permissions.grant",
  "permissions.revoke",
  "permissions.assign_groups",
  "permissions.assign_responsibilities",
  "permissions.promote_super_admin",
  "permissions.remove_super_admin",
  "engineering.manage_tasks",
  // facilitator.* — enforced through program-scoped facilitator
  // authorization (program/team context), not catalog-module literal guards.
  "facilitator.participants.view",
  "facilitator.participants.manage",
  "facilitator.attendance.view",
  "facilitator.attendance.record",
  "facilitator.assignments.view",
  "facilitator.assignments.review",
  "facilitator.assignments.grade",
  "facilitator.sessions.conduct",
  "facilitator.sessions.record",
  "facilitator.progress.view",
  "facilitator.groups.view",
  "facilitator.groups.manage",
  "facilitator.reviews.submit",
]);

test("every literal requireAuthorization usage resolves in the catalog", () => {
  const { usages, fileCount } = collectRouteUsages();
  expect(fileCount).toBeGreaterThan(50); // sanity: the walk really ran
  const missing = [];
  for (const u of [...usages].sort()) {
    const dot = u.lastIndexOf(".");
    const mod = u.slice(0, dot);
    const cap = u.slice(dot + 1);
    if (!CAPABILITY_CATALOG[mod] || !CAPABILITY_CATALOG[mod].capabilities[cap]) {
      missing.push(u);
    }
  }
  expect(missing).toEqual([]);
});

test("every catalog capability is enforced by a route or documented", () => {
  const { usages } = collectRouteUsages();
  const unenforced = [];
  for (const [mod, def] of Object.entries(CAPABILITY_CATALOG)) {
    for (const cap of Object.keys(def.capabilities || {})) {
      if (!usages.has(`${mod}.${cap}`) && !ALLOWED_UNROUTED.has(`${mod}.${cap}`)) {
        unenforced.push(`${mod}.${cap}`);
      }
    }
  }
  expect(unenforced).toEqual([]);
});
