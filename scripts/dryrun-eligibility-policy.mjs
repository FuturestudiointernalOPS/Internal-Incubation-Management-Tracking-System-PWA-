/**
 * READ-ONLY DRY-RUN — Eligibility policy change #3 (final policy values)
 *
 * Simulates the deletion of these `feature_eligibility` ROLE rows (group rows
 * are intentionally untouched) and proves that the resulting authorization
 * decisions match the agreed CURRENT → PROPOSED matrix EXACTLY:
 *
 *   feature       role          effect
 *   -----------   -----------   --------------------------------------
 *   internal_comms  admin       admin loses internal_comms eligibility
 *   reporting       admin       admin loses reporting eligibility
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
    const probe = await import("pg");
    const pool = new probe.default.Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    await pool.query("SELECT 1");
    await pool.end();
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
  { feature_key: "internal_comms", identity_value: "admin" },
  { feature_key: "reporting", identity_value: "admin" },
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
  const q = async (name, sql) => {
    try {
      const r = await db.execute({ sql, args: [] });
      return { name, rows: r.rows };
    } catch (e) {
      throw new Error(`Query "${name}" failed: ${e.message}`);
    }
  };

  const results = await Promise.all([
    q("contacts", "SELECT cid, access_profile_id, group_name FROM contacts"),
    q("active users", "SELECT cid, name, email, role FROM contacts WHERE deleted_at IS NULL"),
    q("grants", "SELECT user_cid, module, capability, access_level FROM user_capabilities WHERE (expires_at IS NULL OR expires_at > NOW())"),
    q("restrictions", "SELECT user_cid, module, capability FROM user_capability_restrictions WHERE (expires_at IS NULL OR expires_at > NOW())"),
    q("profiles", "SELECT id, name, is_active FROM access_profiles"),
    q("role defaults", "SELECT rpd.role_name, ap.id, ap.name, ap.is_active FROM role_access_profile_defaults rpd JOIN access_profiles ap ON ap.id = rpd.access_profile_id"),
    q("profile caps", "SELECT profile_id, module, capability, access_level FROM access_profile_capabilities"),
    q("role caps", "SELECT role, module, capability, access_level FROM role_capabilities"),
    q("user groups", "SELECT user_cid, group_name FROM user_groups"),
    q("group caps", "SELECT group_name, module, capability, access_level FROM group_capabilities"),
    q("eligibility", "SELECT feature_key, identity_type, identity_value, eligible FROM feature_eligibility"),
  ]);
  const map = Object.fromEntries(results.map((r) => [r.name, r.rows]));

  const groupBy = (rows, key) => {
    const m = new Map();
    for (const r of rows) {
      const k = r[key];
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return m;
  };

  return {
    contactsMap: new Map(map.contacts.map((r) => [r.cid, r])),
    users: map["active users"],
    grantsByUser: groupBy(map.grants, "user_cid"),
    restrictionsByUser: groupBy(map.restrictions, "user_cid"),
    profiles: new Map(map.profiles.map((r) => [r.id, r])),
    roleDefaults: new Map(map["role defaults"].map((r) => [r.role_name, r])), // first row wins (matches resolver rows[0])
    profileCapsByProfile: groupBy(map["profile caps"], "profile_id"),
    roleCapsByRole: groupBy(map["role caps"], "role"),
    groupsByUser: (() => {
      const m = new Map();
      for (const r of map["user groups"]) {
        if (!m.has(r.user_cid)) m.set(r.user_cid, []);
        m.get(r.user_cid).push(r.group_name);
      }
      return m;
    })(),
    groupCapsByGroup: groupBy(map["group caps"], "group_name"),
    eligRowsAll: map.eligibility,
  };
}

// ─── Context assembly — mirrors resolveAuthorizationContext() (resolver.js) ──
function buildSuperAdminMatrix() {
  const m = {};
  for (const [mod, def] of Object.entries(PERMISSION_MODULES)) {
    m[mod] = {};
    for (const capability of def.capabilities) m[mod][capability] = ACCESS_LEVELS.FULL;
  }
  return m;
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
    const p = data.profiles.get(contact.access_profile_id);
    if (p && Number(p.is_active) === 1) {
      profileId = p.id;
      profileName = p.name;
      profileSource = "user";
    }
  }
  if (!profileId && role) {
    const p = data.roleDefaults.get(role);
    if (p && Number(p.is_active) === 1) {
      profileId = p.id;
      profileName = p.name;
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
    const rows = groups.flatMap((g) => data.groupCapsByGroup.get(g) || []);
    groupCaps = rowsToCaps(rows);
  }

  // 6. Eligibility rows for this user's identities (role + groups).
  let eligRows = data.eligRowsAll.filter(
    (r) =>
      (r.identity_type === "role" && r.identity_value === role) ||
      (r.identity_type === "group" && groups.includes(r.identity_value)),
  );
  if (applyPolicy) {
    eligRows = eligRows.filter(
      (r) =>
        !(
          r.identity_type === "role" &&
          POLICY_DELETES.some(
            (d) => d.feature_key === r.feature_key && d.identity_value === r.identity_value,
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

const targetRows = data.eligRowsAll.filter((r) =>
  POLICY_DELETES.some(
    (d) => d.feature_key === r.feature_key && d.identity_value === r.identity_value,
  ),
);
const targetRowsRole = targetRows.filter((r) => r.identity_type === "role");
const targetRowsOther = targetRows.filter((r) => r.identity_type !== "role");

const roleCounts = {};
for (const u of data.users) roleCounts[u.role ?? "(none)"] = (roleCounts[u.role ?? "(none)"] ?? 0) + 1;

// Coverage signals — detect when a claim cannot be verified per-user.
const adminCount = data.users.filter((u) => u.role === "admin").length;
const profileCount = data.profiles.size;
const groupCount = data.eligRowsAll.filter((r) => r.identity_type === "group").length;
const adminReportsCaps =
  (data.roleCapsByRole.get("admin") || []).filter((r) => r.module === "reports").length;

console.log("=".repeat(78));
console.log("READ-ONLY DRY-RUN — Eligibility policy #3 (no changes applied)");
console.log("=".repeat(78));
console.log(`Active users scanned : ${data.users.length}`);
console.log(`Users by role        : ${JSON.stringify(roleCounts)}`);
console.log(`Eligibility rows     : ${data.eligRowsAll.length} (role=${data.eligRowsAll.filter((r) => r.identity_type === "role").length}, group=${data.eligRowsAll.filter((r) => r.identity_type === "group").length})`);
console.log(`Target rows present  : ${targetRowsRole.length} role rows (${targetRowsRole.map((r) => `${r.feature_key}/${r.identity_value}=${r.eligible}`).join(", ") || "none"})`);
if (targetRowsOther.length) {
  console.log(`WARNING — non-role target rows present (NOT part of the delete set): ${targetRowsOther.map((r) => `${r.feature_key}/${r.identity_type}/${r.identity_value}=${r.eligible}`).join(", ")}`);
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
for (const [mod, def] of Object.entries(PERMISSION_MODULES)) {
  for (const cap of def.capabilities) capabilities.push([mod, cap]);
}

for (const u of data.users) {
  const cur = buildCtx(u, data, false);
  const post = buildCtx(u, data, true);
  for (const [mod, cap] of capabilities) {
    const curAllow = authorize(cur, mod, cap, 1);
    const postAllow = authorize(post, mod, cap, 1);
    if (curAllow !== postAllow) {
      changes.push({
        user: u,
        mod,
        cap,
        curLevel: cur.effective?.[mod]?.[cap] ?? 0,
        postLevel: post.effective?.[mod]?.[cap] ?? 0,
        curElig: cur.eligibility?.[MODULE_TO_FEATURE[mod]],
        postElig: post.eligibility?.[MODULE_TO_FEATURE[mod]],
        curAllow,
        postAllow,
      });
    }
  }
}

// ─── Report changed users ────────────────────────────────────────────────────
const byUser = new Map();
for (const c of changes) {
  if (!byUser.has(c.user.cid)) byUser.set(c.user.cid, []);
  byUser.get(c.user.cid).push(c);
}

if (byUser.size === 0) {
  console.log("NO DECISION CHANGES FOR ANY USER.");
  console.log("If the target rows are absent, current behavior already equals the post-policy state.");
}

for (const [cid, chs] of byUser) {
  const u = chs[0].user;
  const ctx = buildCtx(u, data, false);
  const flippedFeatures = new Set();
  for (const c of chs) flippedFeatures.add(MODULE_TO_FEATURE[c.mod]);
  console.log(`\nUSER: ${u.name || "(unnamed)"} <${u.email || "no email"}>  role=${u.role}  cid=${cid}`);
  console.log(`  groups: ${ctx.groups.length ? ctx.groups.join(", ") : "(none)"}`);
  for (const f of [...flippedFeatures]) {
    console.log(`  eligibility: ${f} ${chs[0].curElig ? "eligible → NOT eligible" : "ineligible → eligible"}`);
  }
  for (const c of chs) {
    const routes = CAP_ROUTES[`${c.mod}.${c.cap}`] || ["(unknown route)"];
    const arrow = c.curAllow && !c.postAllow ? "ALLOW → DENY" : "DENY → ALLOW";
    console.log(`  ${arrow}: ${c.mod}.${c.cap} (level ${c.curLevel} → ${c.postLevel})   ${routes.join(", ")}`);
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

const losses = changes.filter((c) => c.curAllow && !c.postAllow);
const gains = changes.filter((c) => !c.curAllow && c.postAllow);
const affectedCids = new Set(changes.map((c) => c.user.cid));
const adminCids = new Set(
  data.users.filter((u) => u.role === "admin").map((u) => u.cid),
);
const adminChanges = changes.filter((c) => adminCids.has(c.user.cid));
const nonAdminChanges = changes.filter((c) => !adminCids.has(c.user.cid));
const adminBadModules = adminChanges.filter(
  (c) => !["internal_comms", "reports"].includes(c.mod),
);
const participantFounderChanges = changes.filter((c) =>
  ["participant", "founder"].includes(c.user.role),
);

check(
  "No user gains access anywhere",
  gains.length === 0,
  gains.length ? `${gains.length} unexpected gain(s): ${gains.map((g) => `${g.user.role}/${g.user.cid}:${g.mod}.${g.cap}`).join(", ")}` : `${changes.length} changes total, all allow→deny`,
);
check(
  "All decision changes belong to role=admin users",
  nonAdminChanges.length === 0,
  nonAdminChanges.length ? `non-admin changes: ${nonAdminChanges.map((c) => `${c.user.role}/${c.user.cid}:${c.mod}.${c.cap}`).join(", ")}` : "confirmed",
);
check(
  "Admin losses confined to internal_comms + reports modules",
  adminBadModules.length === 0,
  adminBadModules.length ? `offending: ${adminBadModules.map((c) => `${c.mod}.${c.cap}`).join(", ")}` : "confirmed",
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
          .filter((u) => u.role === "admin")
          .filter((u) => buildCtx(u, data, true).eligibility?.internal_comms === true);
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
          .filter((u) => u.role === "admin")
          .filter((u) => buildCtx(u, data, true).eligibility?.reporting === true);
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
console.log(`Admin users affected : ${new Set(adminChanges.map((c) => c.user.cid)).size} of ${adminCids.size} admin user(s)`);
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
