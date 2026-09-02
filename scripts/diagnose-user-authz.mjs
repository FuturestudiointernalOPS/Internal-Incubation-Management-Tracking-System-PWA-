/**
 * READ-ONLY DIAGNOSTIC — resolve one user's full authorization context from
 * the database and print per-route verdicts. No writes (mirrors the dry-run:
 * batched SELECTs + the resolver's pure functions; seed/backfill write-path
 * never invoked).
 *
 * Run: node scripts/diagnose-user-authz.mjs <cid> [role]
 * Example: node scripts/diagnose-user-authz.mjs USER_81F952EF5279
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

const envCandidates = [".env.dryrun", ".env.local", ".env.audit-staging", ".env.staging"];
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
    console.log(`[diagnose] connected via ${file}`);
    break;
  } catch {}
}

const { initDb } = await import("../src/lib/db.js");
const { rowsToCaps, rowsToRestrictions, mergeEffectiveCapabilities, authorize } =
  await import("../src/lib/authorization/index.js");
const { MODULE_TO_FEATURE, evaluateEligibility } =
  await import("../src/lib/authorization/eligibility.js");
const { PERMISSION_MODULES, ACCESS_LEVELS } = await import("../src/lib/auth.js");

const targetCid = process.argv[2];
if (!targetCid) {
  console.error("usage: node scripts/diagnose-user-authz.mjs <cid> [role]");
  process.exit(2);
}

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
const data = {
  contactsMap: new Map(map.contacts.map((r) => [r.cid, r])),
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

function buildCtx(user, data) {
  const { cid, role } = user;
  const grants = rowsToCaps(data.grantsByUser.get(cid) || []);
  const restrictions = rowsToRestrictions(data.restrictionsByUser.get(cid) || []);
  if (role === "super_admin") {
    const m = {};
    for (const [mod, def] of Object.entries(PERMISSION_MODULES)) {
      m[mod] = {};
      for (const cap of def.capabilities) m[mod][cap] = ACCESS_LEVELS.FULL;
    }
    return {
      cid, role, isSuperAdmin: true, groups: [], profile: null,
      eligibility: null, eligibilityRows: [], baseCaps: m, groupCaps: {},
      effective: mergeEffectiveCapabilities(m, {}, grants, restrictions), grants, restrictions,
    };
  }
  const contact = data.contactsMap.get(cid) || {};
  let profileId = null, profileName = null, profileSource = "legacy";
  if (contact.access_profile_id) {
    const p = data.profiles.get(contact.access_profile_id);
    if (p && Number(p.is_active) === 1) { profileId = p.id; profileName = p.name; profileSource = "user"; }
  }
  if (!profileId && role) {
    const p = data.roleDefaults.get(role);
    if (p && Number(p.is_active) === 1) { profileId = p.id; profileName = p.name; profileSource = "role"; }
  }
  let baseCaps;
  if (profileId) baseCaps = rowsToCaps(data.profileCapsByProfile.get(profileId) || []);
  else baseCaps = rowsToCaps(data.roleCapsByRole.get(role) || []);
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
  for (const featureKey of new Set(Object.values(MODULE_TO_FEATURE))) {
    eligibility[featureKey] = evaluateEligibility(eligRows, featureKey);
  }
  return {
    cid, role, isSuperAdmin: false, groups,
    profile: { profileId, profileName, profileSource },
    eligibility, eligibilityRows: eligRows, baseCaps, groupCaps,
    effective: mergeEffectiveCapabilities(baseCaps, groupCaps, grants, restrictions),
    grants, restrictions,
  };
}

const contact = data.contactsMap.get(targetCid);
if (!contact) {
  console.error(`UNKNOWN cid: ${targetCid}`);
  process.exit(2);
}
const role = process.argv[3] || contact.role;
const user = { cid: targetCid, role };
const ctx = buildCtx(user, data);

const fmt = (level) => (level ? `level ${level}` : "—");
const check = (module, cap, minLevel = 1) => {
  const decision = authorize(ctx, module, cap, minLevel);
  const eff = ctx.effective?.[module]?.[cap] ?? 0;
  const elig = ctx.isSuperAdmin ? true : ctx.eligibility?.[MODULE_TO_FEATURE[module]];
  return `${decision ? "ALLOW" : "DENY"}  (eligible=${elig}, ${module}.${cap}=${fmt(eff)}${eff >= minLevel ? "" : `, needs ≥${minLevel}`})`;
};

console.log("\n" + "=".repeat(78));
console.log(`USER ${targetCid} — role=${role} (from contacts: ${contact.role})  group="${contact.group_name || ""}"`);
console.log("=".repeat(78));
console.log(`Profile source: ${ctx.profile?.profileSource}${ctx.profile?.profileName ? ` (${ctx.profile.profileName})` : ""}`);
console.log(`Groups: ${ctx.groups.length ? ctx.groups.join(", ") : "(none)"}`);
console.log(`Base caps (role_capabilities ${ctx.profile?.profileId ? "or profile" : "fallback"}): ${JSON.stringify(ctx.baseCaps)}`);
console.log(`Grants: ${JSON.stringify(ctx.grants)}`);
console.log(`Restrictions: ${Object.keys(ctx.restrictions).length ? JSON.stringify([...Object.entries(ctx.restrictions)].map(([m, s]) => [m, [...s]])) : "none"}`);
console.log("\n— Route verdicts (current authorization behavior) —");
console.log(`GET  /api/internal-comms        messaging.view   → ${check("messaging", "view")}`);
console.log(`POST /api/internal-comms        messaging.send   → ${check("messaging", "send")}`);
console.log(`GET  /api/pm/programs/[id]      ROLE GATE super_admin|program_manager → ${["super_admin", "program_manager"].includes(role) ? "ALLOW" : "DENY"}`);
console.log(`POST /api/pm/curriculum         programs.edit    → ${check("programs", "edit")}`);
console.log(`GET  /api/participants?prog=    contacts-based assignment gate (see note)`);
console.log(`GET  /api/contacts/search       contacts.view    → ${check("contacts", "view")}`);
console.log(`POST /api/announcements         internal_comms.create_announcements → ${check("internal_comms", "create_announcements")}`);
console.log(`POST /api/op-reports            reports.create   → ${check("reports", "create")}`);

// participants route simulation: staff/teacher/facilitator go through the
// assignment gate which requires facilitator-module participants.view
if (!["super_admin", "program_manager", "teacher"].includes(role)) {
  console.log(`GET  /api/participants (assignment path) facilitator.participants.view → ${check("facilitator", "participants.view")}`);
} else {
  console.log(`GET  /api/participants → management role path (no assignment gate)`);
}

// what caps exist for messaging anywhere
const messagingCaps = map["role caps"].filter((r) => r.module === "messaging");
const messagingGrants = map.grants.filter((r) => r.module === "messaging");
console.log("\n— messaging capability rows anywhere in the DB —");
console.log(`role_capabilities: ${messagingCaps.length ? JSON.stringify(messagingCaps) : "NONE (no role has messaging caps)"}`);
console.log(`user_capabilities: ${messagingGrants.length ? JSON.stringify(messagingGrants) : "NONE"}`);
console.log(`feature_eligibility (messaging): ${JSON.stringify(map.eligibility.filter((r) => r.feature_key === "messaging"))}`);
process.exit(0);
