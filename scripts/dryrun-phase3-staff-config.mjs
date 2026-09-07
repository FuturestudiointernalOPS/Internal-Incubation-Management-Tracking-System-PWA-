/**
 * PHASE 3 — READ-ONLY DRY-RUN: Staff / Future Studio configuration
 *
 * Simulates the proposed configuration WITHOUT writing anything:
 *
 *   PROPOSED STAFF DEFAULT TEMPLATE (Access Profile "Staff Default"):
 *     messaging.view = 1, messaging.send = 2   (internal messaging)
 *     reports.create = 2                       (standups / retros / op-reports)
 *
 * Eligibility is NOT changed (staff rows already exist for programs, finance,
 * projects, reports, messaging, crm, tasks, knowledge, internal_comms).
 *
 * The simulation swaps the staff base from the legacy role_capabilities
 * fallback (43 rows) to the proposed profile caps and diffs every
 * authorization decision per staff user: LOST access (must be reviewed) and
 * GAINED access (intended).
 *
 * Run: node scripts/dryrun-phase3-staff-config.mjs
 */
import { register } from "node:module";
await register(new URL("./lib/import-loader.mjs", import.meta.url));

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

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

for (const file of [".env.dryrun", ".env.local", ".env.audit-staging", ".env.staging"]) {
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
    console.log(`[phase3-dryrun] connected via ${file}`);
    break;
  } catch {}
}

const { initDb } = await import("../src/lib/db.js");
const { rowsToCaps, rowsToRestrictions, mergeEffectiveCapabilities, authorize } =
  await import("../src/lib/authorization/index.js");
const { MODULE_TO_FEATURE, evaluateEligibility, FEATURE_ELIGIBILITY_DEFAULTS } =
  await import("../src/lib/authorization/eligibility.js");
const { PERMISSION_MODULES, ACCESS_LEVELS } = await import("../src/lib/auth.js");

// ─── The proposed Staff default template (configuration, NOT code) ──────────
const PROPOSED_STAFF_TEMPLATE = {
  messaging: { view: 1, send: 2 },
  reports: { create: 2 },
};

const CAP_ROUTES = {
  "messaging.view": ["GET /api/internal-comms"],
  "messaging.send": ["POST /api/internal-comms"],
  "reports.create": ["POST /api/op-reports", "POST /api/standups/submit", "POST /api/retros/submit"],
  "reports.export": ["GET /api/run-export", "GET /api/pm/export"],
  "internal_comms.create_announcements": ["POST /api/announcements"],
  "internal_comms.moderate": ["PUT/DELETE /api/announcements"],
  "projects.delete": ["DELETE /api/projects*"],
  "programs.edit": ["POST/PUT/DELETE /api/pm/curriculum", "/api/pm/teams"],
  "ventures.create": ["POST /api/ventures"],
  "investor.view": ["/api/investor/*"],
  "investor.create": ["/api/investor/*"],
  "investor.edit": ["/api/investor/*"],
  "tasks.view": ["/api/tasks*"],
  "tasks.create": ["/api/tasks*"],
  "tasks.edit": ["/api/tasks*"],
  "tasks.delete": ["/api/tasks*"],
  "knowledge.view": ["/api/knowledge"],
  "knowledge.create": ["/api/knowledge"],
  "knowledge.edit": ["/api/knowledge"],
  "knowledge.delete": ["/api/knowledge"],
};

const db = await initDb();
const q = async (name, sql) => {
  try {
    const r = await db.execute({ sql, args: [] });
    return { name, rows: r.rows };
  } catch (e) {
    throw new Error(`Query "${name}" failed: ${e.message}`);
  }
};

const results = await Promise.all([
  q("contacts", "SELECT cid, access_profile_id, group_name, role FROM contacts"),
  q("active users", "SELECT cid, name, email, role FROM contacts WHERE deleted_at IS NULL"),
  q("grants", "SELECT user_cid, module, capability, access_level FROM user_capabilities WHERE (expires_at IS NULL OR expires_at > NOW())"),
  q("restrictions", "SELECT user_cid, module, capability FROM user_capability_restrictions WHERE (expires_at IS NULL OR expires_at > NOW())"),
  q("profiles", "SELECT id, name, is_active FROM access_profiles"),
  q("role defaults", "SELECT rpd.role_name, ap.id, ap.name FROM role_access_profile_defaults rpd JOIN access_profiles ap ON ap.id = rpd.access_profile_id"),
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
const data = {
  contactsMap: new Map(map.contacts.map((r) => [r.cid, r])),
  users: map["active users"],
  grantsByUser: groupBy(map.grants, "user_cid"),
  restrictionsByUser: groupBy(map.restrictions, "user_cid"),
  profiles: new Map(map.profiles.map((r) => [r.id, r])),
  roleDefaults: new Map(map["role defaults"].map((r) => [r.role_name, r])),
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

function buildCtx(user, data, baseCapsOverride = null) {
  const { cid, role } = user;
  const grants = rowsToCaps(data.grantsByUser.get(cid) || []);
  const restrictions = rowsToRestrictions(data.restrictionsByUser.get(cid) || []);
  const contact = data.contactsMap.get(cid) || {};
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
    if (p) {
      profileId = p.id;
      profileName = p.name;
      profileSource = "role";
    }
  }
  let baseCaps;
  if (baseCapsOverride) {
    baseCaps = baseCapsOverride;
  } else if (profileId) {
    baseCaps = rowsToCaps(data.profileCapsByProfile.get(profileId) || []);
  } else {
    baseCaps = rowsToCaps(data.roleCapsByRole.get(role) || []);
  }
  let groups = data.groupsByUser.get(cid) || [];
  if (groups.length === 0 && contact.group_name) groups = [contact.group_name];
  let groupCaps = {};
  if (groups.length > 0) {
    groupCaps = rowsToCaps(groups.flatMap((g) => data.groupCapsByGroup.get(g) || []));
  }
  const eligRows = data.eligRowsAll.filter(
    (r) =>
      (r.identity_type === "role" && r.identity_value === role) ||
      (r.identity_type === "group" && groups.includes(r.identity_value)),
  );
  const eligibility = {};
  for (const f of new Set(Object.values(MODULE_TO_FEATURE))) {
    eligibility[f] = evaluateEligibility(eligRows, f);
  }
  return {
    cid,
    role,
    isSuperAdmin: role === "super_admin",
    groups,
    profile: { profileId, profileName, profileSource },
    eligibility,
    eligibilityRows: eligRows,
    baseCaps,
    groupCaps,
    effective: mergeEffectiveCapabilities(baseCaps, groupCaps, grants, restrictions),
    grants,
    restrictions,
  };
}

// ─── Report ──────────────────────────────────────────────────────────────────
const staffUsers = data.users.filter((u) => u.role === "staff");
console.log("\n" + "=".repeat(78));
console.log("CURRENT STAFF CONFIGURATION (read-only)");
console.log("=".repeat(78));

console.log("\n— Staff eligibility rows (feature_eligibility, role=staff):");
const staffElig = data.eligRowsAll.filter(
  (r) => r.identity_type === "role" && r.identity_value === "staff",
);
for (const r of staffElig) console.log(`  ${r.feature_key} = eligible ${r.eligible}`);

console.log("\n— Staff role_capabilities (legacy fallback — the CURRENT de-facto template):");
const staffRoleCaps = data.roleCapsByRole.get("staff") || [];
for (const r of staffRoleCaps) console.log(`  ${r.module}.${r.capability} = level ${r.access_level}`);

console.log("\n— Staff access profiles: " + (map.profiles.length ? JSON.stringify(map.profiles) : "(none in DB)"));
console.log("— Role→profile defaults: " + (map["role defaults"].length ? JSON.stringify(map["role defaults"]) : "(none)"));
console.log("— Staff individual grants: " + (data.grantsByUser.get("USER_81F952EF5279") ? JSON.stringify(data.grantsByUser.get("USER_81F952EF5279").map((g) => `${g.module}.${g.capability}=${g.access_level}`)) : "(none)"));
console.log("— Staff restrictions: " + ((data.restrictionsByUser.get("USER_81F952EF5279") || []).length ? "present" : "(none)"));

console.log("\n" + "=".repeat(78));
console.log("PROPOSED STAFF DEFAULT TEMPLATE");
console.log("=".repeat(78));
for (const [mod, caps] of Object.entries(PROPOSED_STAFF_TEMPLATE)) {
  for (const [cap, lvl] of Object.entries(caps)) console.log(`  ${mod}.${cap} = level ${lvl}`);
}
console.log("\n(Eligibility rows unchanged — staff already eligible for programs, finance, projects, reports, messaging.)");

console.log("\n" + "=".repeat(78));
console.log("CURRENT vs PROPOSED — DECISION DIFF per staff user");
console.log("=".repeat(78));

const capabilities = [];
for (const [mod, def] of Object.entries(PERMISSION_MODULES)) {
  for (const cap of def.capabilities) capabilities.push([mod, cap]);
}

for (const u of staffUsers) {
  const cur = buildCtx(u, data, null);
  const post = buildCtx(u, data, PROPOSED_STAFF_TEMPLATE);
  const losses = [];
  const gains = [];
  for (const [mod, cap] of capabilities) {
    const curAllow = authorize(cur, mod, cap, 1);
    const postAllow = authorize(post, mod, cap, 1);
    if (curAllow && !postAllow) losses.push([mod, cap, cur.effective?.[mod]?.[cap] ?? 0]);
    if (!curAllow && postAllow) gains.push([mod, cap, post.effective?.[mod]?.[cap] ?? 0]);
  }
  console.log(`\nUSER ${u.cid} (${u.name || "?"}, ${u.email || ""})`);
  console.log(`  Current base source: ${cur.profile.profileSource}${cur.profile.profileName ? ` (${cur.profile.profileName})` : " (role_capabilities fallback)"}`);
  console.log(`\n  ⚠️ LOST ACCESS (${losses.length}) — must be reviewed:`);
  for (const [mod, cap, lvl] of losses) {
    const routes = CAP_ROUTES[`${mod}.${cap}`] || ["(unknown route)"];
    console.log(`    ${mod}.${cap} (level ${lvl})  → ${routes.join(", ")}`);
  }
  console.log(`\n  ✅ GAINED ACCESS (${gains.length}) — intended by the template:`);
  for (const [mod, cap, lvl] of gains) {
    const routes = CAP_ROUTES[`${mod}.${cap}`] || ["(unknown route)"];
    console.log(`    ${mod}.${cap} (level ${lvl})  → ${routes.join(", ")}`);
  }
  console.log(`\n  Unchanged: contacts grants (individual), eligibility rows.`);
}

// ─── Mapping table (§13.3) ───────────────────────────────────────────────────
console.log("\n" + "=".repeat(78));
console.log("MAPPING — every current Staff capability → disposition");
console.log("=".repeat(78));
console.log("  KEEP-AS-DEFAULT   = belongs in the new Staff template");
console.log("  INDIVIDUAL        = only when Super Admin grants it to a person");
console.log("  CONTEXTUAL        = future Program/Project-scoped layer");
console.log("  REMOVE/LEGACY     = artifact of earlier backfills; not part of the template");
console.log("-".repeat(78));
const DISPOSITION = {
  "messaging.view": "KEEP-AS-DEFAULT",
  "messaging.send": "KEEP-AS-DEFAULT",
  "reports.create": "KEEP-AS-DEFAULT (standups/retros/op-reports)",
  "reports.export": "CONTEXTUAL/INDIVIDUAL (run-export is program/ops reporting)",
  "tasks.view": "UNDECIDED — genuinely common? (currently granted by role)",
  "tasks.create": "UNDECIDED — genuinely common?",
  "tasks.edit": "UNDECIDED — genuinely common?",
  "tasks.delete": "UNDECIDED — genuinely common?",
  "knowledge.view": "UNDECIDED — genuinely common?",
  "knowledge.create": "UNDECIDED",
  "knowledge.edit": "UNDECIDED",
  "knowledge.delete": "UNDECIDED",
  "internal_comms.create_announcements": "INDIVIDUAL (announcements are a chosen responsibility)",
  "internal_comms.moderate": "INDIVIDUAL",
  "projects.delete": "INDIVIDUAL/CONTEXTUAL",
  "programs.edit": "INDIVIDUAL/CONTEXTUAL (Program Manager assignment)",
  "ventures.create": "INDIVIDUAL/CONTEXTUAL",
  "investor.view": "INDIVIDUAL",
  "investor.create": "INDIVIDUAL",
  "investor.edit": "INDIVIDUAL",
};
for (const r of staffRoleCaps) {
  const d = DISPOSITION[`${r.module}.${r.capability}`] || "REMOVE/LEGACY (not in the new template)";
  console.log(`  ${r.module}.${r.capability} (level ${r.access_level})  →  ${d}`);
}

// ─── Exact DB changes (§13.4) ────────────────────────────────────────────────
console.log("\n" + "=".repeat(78));
console.log("EXACT DATABASE CHANGES (would be applied ONLY after approval)");
console.log("=".repeat(78));
console.log("  1. INSERT INTO access_profiles (name, description, is_protected, is_active)");
console.log("     VALUES ('Staff Default', 'Phase 3 Staff baseline', 0, 1);");
console.log("  2. INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)");
console.log("     VALUES ((SELECT id FROM access_profiles WHERE name='Staff Default'), 'messaging', 'view', 1),");
console.log("            (..., 'messaging', 'send', 2),");
console.log("            (..., 'reports', 'create', 2);");
console.log("  3. INSERT INTO role_access_profile_defaults (role_name, access_profile_id)");
console.log("     VALUES ('staff', (SELECT id FROM access_profiles WHERE name='Staff Default'))");
console.log("     ON CONFLICT (role_name) DO UPDATE SET access_profile_id = EXCLUDED.access_profile_id;");
console.log("  4. NO eligibility rows change. NO role_capabilities rows are deleted (left as review artifacts).");
console.log("  5. NO code changes. NO migration files. Pure configuration via the Permissions Control Center.");

console.log("\n" + "=".repeat(78));
console.log("VERDICT");
console.log("=".repeat(78));
if (staffUsers.length === 0) {
  console.log("NO staff users in this database — the template applies to future/other users.");
} else {
  console.log("The template FIXES (by configuration): staff messaging 403 + standups/retros 403.");
  console.log("It REMOVES (by configuration): tasks, knowledge, announcements, run-export,");
  console.log("projects.delete, programs.edit, ventures.create, investor — per the phase's minimal-default rule.");
  console.log("Every removal must be reviewed in the mapping table before applying.");
}
process.exit(0);
