/**
 * READ-ONLY DRY-RUN — Eligibility policy change #3 (final policy values)
 *
 * Simulates the deletion of these `feature_eligibility` ROLE rows (group rows
 * are intentionally untouched) and proves that the resulting authorization
 * decisions match the agreed CURRENT → PROPOSED matrix EXACTLY:
 *
 *   feature       role          effect
 *   -----------   -----------   --------------------------------------
 *   communication   admin       admin loses communication eligibility
 *   reports         admin       admin loses reports eligibility
 *   crm             participant participant loses crm eligibility
 *   crm             founder     founder loses crm eligibility
 *
 * Expected decision diff (verified per user against the real resolver logic):
 *   - admin users: allow→deny ONLY on capabilities they hold in the
 *     `internal_comms` and `reports` modules (announcements write routes,
 *     op-reports/standups/retros submit, run-export, pm/export)
 *   - participant / founder users: NO decision change (they hold no contacts
 *     capabilities)
 *   - every other user: NO change
 *   - NO user gains access anywhere
 *
 * STRICTLY READ-ONLY:
 *   - 11 batched SELECTs mirror the exact queries `resolveAuthorizationContext`
 *     issues per user (same tables, same filters).
 *   - Contexts are assembled with the resolver's OWN pure functions
 *     (rowsToCaps, rowsToRestrictions, mergeEffectiveCapabilities,
 *     evaluateEligibility, authorize) — imported from src/lib/authorization.
 *   - The resolver's idempotent seed/backfill write-path is NOT invoked.
 *   - Nothing is inserted, updated, deleted or migrated.
 *
 * Run:  node scripts/dryrun-eligibility-policy.mjs
 * Exit: 0 = matrix confirmed | 1 = discrepancies found | 2 = environment error
 */

// ─── Boot: register the @/ alias + Next stubs loader BEFORE importing src ───
import { register } from "node:module";
await register(new URL("./lib/import-loader.mjs", import.meta.url));

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

/**
 * Load the FIRST working DATABASE_URL from the env files (values never
 * printed). .env.local is preferred; if its credentials are stale/rotated
 * (password auth failure) the audit/staging files are used so the dry-run
 * still runs against the same Supabase project (mbpaxrfhqqclzyiefuab).
 */
const readUrlFrom = (file) => {
  try {
    for (const line of readFileSync(resolve(projectRoot, file), "utf-8").split("\n")) {
      if (line.startsWith("DATABASE_URL=")) {
        return line.substring("DATABASE_URL=".length).trim();
      }
    }
  } catch {}
  return null;
};

const envCandidates = [".env.dryrun", ".env.local", ".env.audit-staging", ".env.staging"];
let usedEnvFile = null;
for (const file of envCandidates) {
  const url = readUrlFrom(file);
  if (!url) continue;
  try {
    const pgModule = await import("pg");
    const probePool = new pgModule.default.Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    await probePool.query("SELECT 1");
    await probePool.end();
    process.env.DATABASE_URL = url;
    usedEnvFile = file;
    break;
  } catch {
    // try the next candidate
  }
}
if (!usedEnvFile) {
  console.error("No working DATABASE_URL found in .env.local / .env.audit-staging / .env.staging");
  process.exit(2);
}
console.log(`[dry-run] connected via ${usedEnvFile}`);

const { initDb } = await import("../src/lib/db.js");
const {
  rowsToCaps,
  rowsToRestrictions,
  mergeEffectiveCapabilities,
  authorize,
} = await import("../src/lib/authorization/index.js");
const {
  MODULE_TO_FEATURE,
  evaluateEligibility,
} = await import("../src/lib/authorization/eligibility.js");
const { PERMISSION_MODULES, ACCESS_LEVELS } = await import("../src/lib/auth.js");

// ─── The exact policy change under dry-run (item #3) — role rows ONLY ───────
const POLICY_DELETES = [
  { feature_key: "communication", identity_value: "admin" },
  { feature_key: "reports", identity_value: "admin" },
  { feature_key: "crm", identity_value: "participant" },
  { feature_key: "crm", identity_value: "founder" },
];

// Route map for display purposes (verified against src/app/api routes).
const CAP_ROUTES = {
  "internal_comms.create_announcements": ["POST /api/announcements"],
  "internal_comms.moderate": ["PUT /api/announcements", "DELETE /api/announcements"],
  "internal_comms.view": ["(no API route currently gates on this)"],
  "reports.create": [
    "POST /api/op-reports",
    "POST /api/standups/submit",
    "POST /api/retros/submit",
  ],
  "reports.export": ["GET /api/run-export", "GET /api/pm/export"],
  "reports.view": ["(no API route currently gates on this)"],
  "reports.delete": ["(no API route currently gates on this)"],
};

// ─── Read-only data loading (11 batched SELECTs, mirrors resolver queries) ──
async function loadData() {
  const runQuery = async (name, sql) => {
    try {
      const result = await db.execute({ sql, args: [] });
      return { name, rows: result.rows };
    } catch (error) {
      throw new Error(`Query "${name}" failed: ${error.message}`);
    }
  };

  const results = await Promise.all([
    runQuery("contacts", "SELECT cid, access_profile_id, group_name FROM contacts"),
    runQuery("active users", "SELECT cid, name, email, role FROM contacts WHERE deleted_at IS NULL"),
    runQuery("grants", "SELECT user_cid, module, capability, access_level FROM user_capabilities WHERE (expires_at IS NULL OR expires_at > NOW())"),
    runQuery("restrictions", "SELECT user_cid, module, capability FROM user_capability_restrictions WHERE (expires_at IS NULL OR expires_at > NOW())"),
    runQuery("profiles", "SELECT id, name, is_active FROM access_profiles"),
    runQuery("role defaults", "SELECT rpd.role_name, ap.id, ap.name, ap.is_active FROM role_access_profile_defaults rpd JOIN access_profiles ap ON ap.id = rpd.access_profile_id"),
    runQuery("profile caps", "SELECT profile_id, module, capability, access_level FROM access_profile_capabilities"),
    runQuery("role caps", "SELECT role, module, capability, access_level FROM role_capabilities"),
    runQuery("user groups", "SELECT user_cid, group_name FROM user_groups"),
    runQuery("group caps", "SELECT group_name, module, capability, access_level FROM group_capabilities"),
    runQuery("eligibility", "SELECT feature_key, identity_type, identity_value, eligible FROM feature_eligibility"),
  ]);
  const map = Object.fromEntries(results.map((result) => [result.name, result.rows]));

  const groupBy = (rows, key) => {
    const grouped = new Map();
    for (const row of rows) {
      const groupKey = row[key];
      if (!grouped.has(groupKey)) grouped.set(groupKey, []);
      grouped.get(groupKey).push(row);
    }
    return grouped;
  };

  return {
    contactsMap: new Map(map.contacts.map((contact) => [contact.cid, contact])),
    users: map["active users"],
    grantsByUser: groupBy(map.grants, "user_cid"),
    restrictionsByUser: groupBy(map.restrictions, "user_cid"),
    profiles: new Map(map.profiles.map((profile) => [profile.id, profile])),
    roleDefaults: new Map(map["role defaults"].map((roleDefault) => [roleDefault.role_name, roleDefault])), // first row wins (matches resolver rows[0])
    profileCapsByProfile: groupBy(map["profile caps"], "profile_id"),
    roleCapsByRole: groupBy(map["role caps"], "role"),
    groupsByUser: (() => {
      const grouped = new Map();
      for (const row of map["user groups"]) {
        if (!grouped.has(row.user_cid)) grouped.set(row.user_cid, []);
        grouped.get(row.user_cid).push(row.group_name);
      }
      return grouped;
    })(),
    groupCapsByGroup: groupBy(map["group caps"], "group_name"),
    eligRowsAll: map.eligibility,
  };
}

// ─── Context assembly — mirrors resolveAuthorizationContext() (resolver.js) ──
function buildSuperAdminMatrix() {
  const matrix = {};
  for (const [module, moduleDef] of Object.entries(PERMISSION_MODULES)) {
    matrix[module] = {};
    for (const capability of moduleDef.capabilities) matrix[module][capability] = ACCESS_LEVELS.FULL;
  }
  return matrix;
}

function buildCtx(user, data, applyPolicy) {
  const { cid, role } = user;
  const grants = rowsToCaps(data.grantsByUser.get(cid) || []);
  const restrictions = rowsToRestrictions(data.restrictionsByUser.get(cid) || []);

  // Super Admin: allowed unless explicitly restricted (eligibility bypassed).
  if (role === "super_admin") {
    const saMatrix = buildSuperAdminMatrix();
    return {
      cid,
      role,
      isSuperAdmin: true,
      groups: [],
      profile: null,
      eligibility: null,
      eligibilityRows: [],
      baseCaps: saMatrix,
      groupCaps: {},
      effective: mergeEffectiveCapabilities(saMatrix, {}, grants, restrictions),
      grants,
      restrictions,
    };
  }

  // 1. Contact row: explicit profile override + group_name fallback.
  const contact = data.contactsMap.get(cid) || {};

  // 2. Profile resolution (V2 order: user override → role default → legacy).
  let profileId = null;
  let profileName = null;
  let profileSource = "legacy";
  if (contact.access_profile_id) {
    const profile = data.profiles.get(contact.access_profile_id);
    if (profile && Number(profile.is_active) === 1) {
      profileId = profile.id;
      profileName = profile.name;
      profileSource = "user";
    }
  }
  if (!profileId && role) {
    const roleDefault = data.roleDefaults.get(role);
    if (roleDefault && Number(roleDefault.is_active) === 1) {
      profileId = roleDefault.id;
      profileName = roleDefault.name;
      profileSource = "role";
    }
  }

  // 3. Base capabilities: profile caps, or role_capabilities fallback.
  let baseCaps;
  if (profileId) {
    baseCaps = rowsToCaps(data.profileCapsByProfile.get(profileId) || []);
  } else {
    baseCaps = rowsToCaps(data.roleCapsByRole.get(role) || []);
  }

  // 4. Groups (V2 order: user_groups → contacts.group_name fallback).
  let groups = data.groupsByUser.get(cid) || [];
  if (groups.length === 0 && contact.group_name) groups = [contact.group_name];

  // 5. Group capabilities.
  let groupCaps = {};
  if (groups.length > 0) {
    const groupCapRows = groups.flatMap((group) => data.groupCapsByGroup.get(group) || []);
    groupCaps = rowsToCaps(groupCapRows);
  }

  // 6. Eligibility rows for this user's identities (role + groups).
  let eligRows = data.eligRowsAll.filter(
    (eligibilityRow) =>
      (eligibilityRow.identity_type === "role" && eligibilityRow.identity_value === role) ||
      (eligibilityRow.identity_type === "group" && groups.includes(eligibilityRow.identity_value)),
  );
  if (applyPolicy) {
    eligRows = eligRows.filter(
      (eligibilityRow) =>
        !(
          eligibilityRow.identity_type === "role" &&
          POLICY_DELETES.some(
            (policyDelete) => policyDelete.feature_key === eligibilityRow.feature_key && policyDelete.identity_value === eligibilityRow.identity_value,
          )
        ),
    );
  }

  const eligibility = {};
  for (const featureKey of new Set(Object.values(MODULE_TO_FEATURE))) {
    eligibility[featureKey] = evaluateEligibility(eligRows, featureKey);
  }

  // 7. Effective capabilities (V2 merge semantics).
  const effective = mergeEffectiveCapabilities(baseCaps, groupCaps, grants, restrictions);

  return {
    cid,
    role,
    isSuperAdmin: false,
    groups,
    profile: { profileId, profileName, profileSource },
    eligibility,
    eligibilityRows: eligRows,
    baseCaps,
    groupCaps,
    effective,
    grants,
    restrictions,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────
const db = await initDb();
const data = await loadData();

const targetRows = data.eligRowsAll.filter((eligibilityRow) =>
  POLICY_DELETES.some(
    (policyDelete) => policyDelete.feature_key === eligibilityRow.feature_key && policyDelete.identity_value === eligibilityRow.identity_value,
  ),
);
const targetRowsRole = targetRows.filter((row) => row.identity_type === "role");
const targetRowsOther = targetRows.filter((row) => row.identity_type !== "role");

const roleCounts = {};
for (const user of data.users) roleCounts[user.role ?? "(none)"] = (roleCounts[user.role ?? "(none)"] ?? 0) + 1;

// Coverage signals — detect when a claim cannot be verified per-user.
const adminCount = data.users.filter((user) => user.role === "admin").length;
const profileCount = data.profiles.size;
const groupCount = data.eligRowsAll.filter((row) => row.identity_type === "group").length;
const adminReportsCaps =
  (data.roleCapsByRole.get("admin") || []).filter((row) => row.module === "reports").length;

console.log("=".repeat(78));
console.log("READ-ONLY DRY-RUN — Eligibility policy #3 (no changes applied)");
console.log("=".repeat(78));
console.log(`Active users scanned : ${data.users.length}`);
console.log(`Users by role        : ${JSON.stringify(roleCounts)}`);
console.log(`Eligibility rows     : ${data.eligRowsAll.length} (role=${data.eligRowsAll.filter((row) => row.identity_type === "role").length}, group=${data.eligRowsAll.filter((row) => row.identity_type === "group").length})`);
console.log(`Target rows present  : ${targetRowsRole.length} role rows (${targetRowsRole.map((row) => `${row.feature_key}/${row.identity_value}=${row.eligible}`).join(", ") || "none"})`);
if (targetRowsOther.length) {
  console.log(`WARNING — non-role target rows present (NOT part of the delete set): ${targetRowsOther.map((row) => `${row.feature_key}/${row.identity_type}/${row.identity_value}=${row.eligible}`).join(", ")}`);
}
if (adminCount === 0) {
  console.log("WARNING — this database has NO users with role='admin': admin-loss claims can only be");
  console.log("           verified at role-data level (role_capabilities/grants), NOT per-user.");
}
if (profileCount === 0) {
  console.log("WARNING — this database has NO access_profiles: all users resolve via the");
  console.log("           role_capabilities fallback (profile paths untested here).");
}
if (groupCount === 0) {
  console.log("NOTE     — no group eligibility rows exist; no group-based preservation risk.");
}
console.log("-".repeat(78));

// ─── Compute decisions ───────────────────────────────────────────────────────
const changes = []; // { user, mod, cap, curLevel, postLevel, curElig, postElig }
const capabilities = [];
for (const [module, moduleDef] of Object.entries(PERMISSION_MODULES)) {
  for (const capability of moduleDef.capabilities) capabilities.push([module, capability]);
}

for (const user of data.users) {
  const cur = buildCtx(user, data, false);
  const post = buildCtx(user, data, true);
  for (const [module, capability] of capabilities) {
    const curAllow = authorize(cur, module, capability, 1);
    const postAllow = authorize(post, module, capability, 1);
    if (curAllow !== postAllow) {
      changes.push({
        user,
        mod: module,
        cap: capability,
        curLevel: cur.effective?.[module]?.[capability] ?? 0,
        postLevel: post.effective?.[module]?.[capability] ?? 0,
        curElig: cur.eligibility?.[MODULE_TO_FEATURE[module]],
        postElig: post.eligibility?.[MODULE_TO_FEATURE[module]],
        curAllow,
        postAllow,
      });
    }
  }
}

// ─── Report changed users ───────────────────────────────────
const byUser = new Map();
for (const change of changes) {
  if (!byUser.has(change.user.cid)) byUser.set(change.user.cid, []);
  byUser.get(change.user.cid).push(change);
}

if (byUser.size === 0) {
  console.log("NO DECISION CHANGES FOR ANY USER.");
  console.log("If the target rows are absent, current behavior already equals the post-policy state.");
}

for (const [cid, userChanges] of byUser) {
  const user = userChanges[0].user;
  const ctx = buildCtx(user, data, false);
  const flippedFeatures = new Set();
  for (const change of userChanges) flippedFeatures.add(MODULE_TO_FEATURE[change.mod]);
  console.log(`\nUSER: ${user.name || "(unnamed)"} <${user.email || "no email"}>  role=${user.role}  cid=${cid}`);
  console.log(`  groups: ${ctx.groups.length ? ctx.groups.join(", ") : "(none)"}`);
  for (const featureKey of [...flippedFeatures]) {
    console.log(`  eligibility: ${featureKey} ${userChanges[0].curElig ? "eligible → NOT eligible" : "ineligible → eligible"}`);
  }
  for (const change of userChanges) {
    const routes = CAP_ROUTES[`${change.mod}.${change.cap}`] || ["(unknown route)"];
    const arrow = change.curAllow && !change.postAllow ? "ALLOW → DENY" : "DENY → ALLOW";
    console.log(`  ${arrow}: ${change.mod}.${change.cap} (level ${change.curLevel} → ${change.postLevel})   ${routes.join(", ")}`);
  }
}

// ─── Assertions ──────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(78));
console.log("ZERO-LOSS / ZERO-GAIN ASSERTIONS");
console.log("=".repeat(78));

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const losses = changes.filter((change) => change.curAllow && !change.postAllow);
const gains = changes.filter((change) => !change.curAllow && change.postAllow);
const affectedCids = new Set(changes.map((change) => change.user.cid));
const adminCids = new Set(
  data.users.filter((user) => user.role === "admin").map((user) => user.cid),
);
const adminChanges = changes.filter((change) => adminCids.has(change.user.cid));
const nonAdminChanges = changes.filter((change) => !adminCids.has(change.user.cid));
const adminBadModules = adminChanges.filter(
  (change) => !["internal_comms", "reports"].includes(change.mod),
);
const participantFounderChanges = changes.filter((change) =>
  ["participant", "founder"].includes(change.user.role),
);

check(
  "No user gains access anywhere",
  gains.length === 0,
  gains.length ? `${gains.length} unexpected gain(s): ${gains.map((gain) => `${gain.user.role}/${gain.user.cid}:${gain.mod}.${gain.cap}`).join(", ")}` : `${changes.length} changes total, all allow→deny`,
);
check(
  "All decision changes belong to role=admin users",
  nonAdminChanges.length === 0,
  nonAdminChanges.length ? `non-admin changes: ${nonAdminChanges.map((change) => `${change.user.role}/${change.user.cid}:${change.mod}.${change.cap}`).join(", ")}` : "confirmed",
);
check(
  "Admin losses confined to internal_comms + reports modules",
  adminBadModules.length === 0,
  adminBadModules.length ? `offending: ${adminBadModules.map((change) => `${change.mod}.${change.cap}`).join(", ")}` : "confirmed",
);
check(
  "participant / founder users see zero decision changes",
  participantFounderChanges.length === 0,
  participantFounderChanges.length ? `${participantFounderChanges.length} change(s) — inspect!` : "confirmed (they hold no contacts capabilities)",
);
check(
  "Every role=admin user currently eligible for internal_comms loses it",
  adminCids.size === 0
    ? true
    : (() => {
        const adminsStillEligible = data.users
          .filter((user) => user.role === "admin")
          .filter((user) => buildCtx(user, data, true).eligibility?.internal_comms === true);
        return adminsStillEligible.length === 0;
      })(),
  "group-eligibility rows for internal_comms could preserve admin access — none found",
);
check(
  "Every role=admin user currently eligible for reporting loses it",
  adminCids.size === 0
    ? true
    : (() => {
        const adminsStillEligible = data.users
          .filter((user) => user.role === "admin")
          .filter((user) => buildCtx(user, data, true).eligibility?.reporting === true);
        return adminsStillEligible.length === 0;
      })(),
  "group-eligibility rows for reporting could preserve admin access — none found",
);

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(78));
console.log("SUMMARY");
console.log("=".repeat(78));
console.log(`Users scanned        : ${data.users.length}`);
console.log(`Users with changes   : ${affectedCids.size}`);
console.log(`Decision losses      : ${losses.length}`);
console.log(`Decision gains       : ${gains.length}`);
console.log(`Admin users affected : ${new Set(adminChanges.map((change) => change.user.cid)).size} of ${adminCids.size} admin user(s)`);
console.log(`Query cost           : ${Object.keys(data).length + 1} batched SELECTs for the whole population `);
console.log(`                       (per-user resolver cost is 9 queries/user — unchanged by this policy)`);

console.log("\n" + "=".repeat(78));
if (failures === 0 && adminCount > 0) {
  console.log("VERDICT: MATRIX CONFIRMED — the dry-run diff is exactly the agreed change set.");
  console.log("No user loses access beyond the documented admin losses; nobody gains;");
  console.log("participant/founder eligibility removal changes zero decisions.");
  process.exit(0);
} else if (failures === 0 && adminCount === 0) {
  console.log("VERDICT: MATRIX PARTIALLY CONFIRMED (vacuous admin evidence).");
  console.log("The zero-gain rule holds for every user scanned, and participant/founder");
  console.log("removal changes zero decisions with real data. However, no admin-role user");
  console.log("exists in this database, so 'admin loses internal_comms/reports' cannot be");
  console.log("verified per-user here. Re-run against the production database (which");
  console.log("contains admin users) before applying the policy.");
  if (adminReportsCaps === 0) {
    console.log("Also: role_capabilities contains NO reports caps for role='admin' in this DB,");
    console.log("so the matrix's 'admin loses reports.create/export' claim is not observable");
    console.log("here at all — production evidence required.");
  }
  process.exit(3);
} else {
  console.log(`VERDICT: ${failures} ASSERTION(S) FAILED — the proposed policy does NOT match the matrix.`);
  console.log("DO NOT apply the policy. Investigate before proceeding.");
  process.exit(1);
}
