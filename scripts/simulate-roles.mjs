/**
 * FULL AUTHORIZATION ROLE SIMULATION (Phase 10 follow-up).
 *
 * Executes the REAL authorization resolver (src/lib/authorization) against
 * REAL production data, read-only, for representative identities of every
 * supported role. Prints per-user identity, profile, membership, grants,
 * restrictions and a capability matrix verdict.
 *
 * Context/assignment behavior is exercised by src/__tests__/context-access
 * (the real requireScopedAccess helper) — this script covers the resolver
 * layer. Nothing is written.
 *
 * Run: node scripts/simulate-roles.mjs
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
      if (line.startsWith("DATABASE_URL=")) return line.substring("DATABASE_URL=".length).trim();
    }
  } catch {}
  return null;
};

for (const file of [".env.local", ".env.audit-staging"]) {
  const url = readUrlFrom(file);
  if (!url) continue;
  try {
    const probe = await import("pg");
    const pool = new probe.default.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
    await pool.query("SELECT 1");
    await pool.end();
    process.env.DATABASE_URL = url;
    console.log(`[simulate] connected via ${file}`);
    break;
  } catch {}
}

const { initDb } = await import("../src/lib/db.js");
const { rowsToCaps, rowsToRestrictions, mergeEffectiveCapabilities, authorize } = await import("../src/lib/authorization/index.js");
const { MODULE_TO_FEATURE, evaluateEligibility } = await import("../src/lib/authorization/eligibility.js");
const { getEffectiveGroupsForUser } = await import("../src/lib/authorization/membership.js");
const { PERMISSION_MODULES, ACCESS_LEVELS } = await import("../src/lib/auth.js");

const db = await initDb();
const q = async (sql) => (await db.execute({ sql, args: [] })).rows;

const [contacts, grants, restrictions, profiles, roleDefaults, profileCaps, roleCaps, userGroups, groupCaps, eligRows, programStaff, projectMembers, contactRoles] =
  await Promise.all([
    q("SELECT cid, name, email, role, access_profile_id, group_name, status FROM contacts"),
    q("SELECT user_cid, module, capability, access_level FROM user_capabilities WHERE (expires_at IS NULL OR expires_at > NOW())"),
    q("SELECT user_cid, module, capability FROM user_capability_restrictions WHERE (expires_at IS NULL OR expires_at > NOW())"),
    q("SELECT id, name, is_active FROM access_profiles"),
    q("SELECT role_name, access_profile_id FROM role_access_profile_defaults"),
    q("SELECT profile_id, module, capability, access_level FROM access_profile_capabilities"),
    q("SELECT role, module, capability, access_level FROM role_capabilities"),
    q("SELECT user_cid, group_name FROM user_groups"),
    q("SELECT group_name, module, capability, access_level FROM group_capabilities"),
    q("SELECT feature_key, identity_type, identity_value, eligible FROM feature_eligibility"),
    q("SELECT program_id, staff_id, role, permissions FROM v2_program_staff"),
    q("SELECT project_id, user_cid FROM project_members"),
    q("SELECT contact_cid, context_type, context_id, role, is_current FROM contact_roles"),
  ]);

const contactsMap = new Map(contacts.map((r) => [r.cid, r]));
const groupBy = (rows, key) => {
  const m = new Map();
  for (const r of rows) {
    if (!m.has(r[key])) m.set(r[key], []);
    m.get(r[key]).push(r);
  }
  return m;
};
const data = {
  contactsMap,
  grantsByUser: groupBy(grants, "user_cid"),
  restrictionsByUser: groupBy(restrictions, "user_cid"),
  profiles: new Map(profiles.map((r) => [r.id, r])),
  roleDefaults: new Map(roleDefaults.map((r) => [r.role_name, r])),
  profileCapsByProfile: groupBy(profileCaps, "profile_id"),
  roleCapsByRole: groupBy(roleCaps, "role"),
  groupsByUser: groupBy(userGroups, "user_cid"),
  groupCapsByGroup: groupBy(groupCaps, "group_name"),
  eligRowsAll: eligRows,
  programStaff,
  projectMembers,
  contactRoles,
};

async function buildCtx(cid, role, data) {
  const grants = rowsToCaps(data.grantsByUser.get(cid) || []);
  const restrictions = rowsToRestrictions(data.restrictionsByUser.get(cid) || []);
  if (role === "super_admin") {
    const m = {};
    for (const [mod, def] of Object.entries(PERMISSION_MODULES)) {
      m[mod] = {};
      for (const cap of def.capabilities) m[mod][cap] = ACCESS_LEVELS.FULL;
    }
    return { cid, role, isSuperAdmin: true, groups: [], profile: null, eligibility: null, baseCaps: m, groupCaps: {}, effective: mergeEffectiveCapabilities(m, {}, grants, restrictions), grants, restrictions };
  }
  const contact = data.contactsMap.get(cid) || {};
  // Profile resolution — mirrors resolveAuthorizationContext exactly:
  // user override → role default (active profile only) → legacy fallback.
  let profileId = null, profileName = null, profileSource = "legacy";
  if (contact.access_profile_id) {
    const p = data.profiles.get(contact.access_profile_id);
    if (p && Number(p.is_active) === 1) { profileId = p.id; profileName = p.name; profileSource = "user"; }
  }
  if (!profileId && role) {
    const d = data.roleDefaults.get(role);
    const p = d && data.profiles.get(d.access_profile_id);
    if (p && Number(p.is_active) === 1) { profileId = p.id; profileName = p.name; profileSource = "role"; }
  }
  let baseCaps;
  if (profileId) baseCaps = rowsToCaps(data.profileCapsByProfile.get(profileId) || []);
  else baseCaps = rowsToCaps(data.roleCapsByRole.get(role) || []);
  const groups = await getEffectiveGroupsForUser(cid);
  const groupCaps = groups.length > 0 ? rowsToCaps(groups.flatMap((g) => data.groupCapsByGroup.get(g) || [])) : {};
  const eligRows = data.eligRowsAll.filter(
    (r) => (r.identity_type === "role" && r.identity_value === role) || (r.identity_type === "group" && groups.includes(r.identity_value)),
  );
  const eligibility = {};
  for (const featureKey of new Set(Object.values(MODULE_TO_FEATURE))) eligibility[featureKey] = evaluateEligibility(eligRows, featureKey);
  return { cid, role, isSuperAdmin: false, groups, profile: { profileId, profileName, profileSource }, eligibility, baseCaps, groupCaps, effective: mergeEffectiveCapabilities(baseCaps, groupCaps, grants, restrictions), grants, restrictions };
}

// Capability matrix (module, capability, minLevel)
const MATRIX = [
  ["messaging", "view"], ["messaging", "send"],
  ["reports", "create"], ["reports", "export"],
  ["tasks", "view"], ["tasks", "create"], ["tasks", "edit"], ["tasks", "delete"],
  ["knowledge", "view"], ["knowledge", "create"], ["knowledge", "edit"], ["knowledge", "delete"],
  ["programs", "view"], ["programs", "create"], ["programs", "edit"], ["programs", "publish"],
  ["projects", "view"], ["projects", "create"], ["projects", "edit"], ["projects", "delete"],
  ["contacts", "view"], ["contacts", "create"],
  ["internal_comms", "create_announcements"], ["internal_comms", "moderate"],
  ["ventures", "create"], ["ventures", "view"],
  ["investor", "view"], ["investor", "create"],
  ["finance", "view"],
  ["facilitator", "participants.view"],
  ["org_membership", "view"], ["org_membership", "manage"],
  ["permissions", "view_matrix"], ["permissions", "assign_capabilities"], ["permissions", "configure_eligibility"],
];

const fmt = (lvl) => (lvl ? `L${lvl}` : "—");

// ── Configuration summary (role defaults, profiles, group caps, eligibility rows) ──
console.log("═".repeat(86));
console.log("CONFIGURATION SNAPSHOT (read-only)");
console.log(`access_profiles: ${profiles.length} — ${profiles.map((p) => `${p.name}${Number(p.is_active) === 1 ? "" : " (inactive)"}`).join(", ")}`);
console.log(
  `role_access_profile_defaults: ${roleDefaults.length} — ${roleDefaults
    .map((d) => `${d.role_name} → ${data.profiles.get(d.access_profile_id)?.name || d.access_profile_id}`)
    .join(", ")}`,
);
const roleCapsCount = new Map();
for (const r of roleCaps) roleCapsCount.set(r.role, (roleCapsCount.get(r.role) || 0) + 1);
console.log(`role_capabilities (legacy fallback) rows per role: ${[...roleCapsCount.entries()].map(([r, n]) => `${r}:${n}`).join(", ")}`);
console.log(`group_capabilities: ${groupCaps.length} rows — groups: ${[...new Set(groupCaps.map((g) => g.group_name))].join(", ")}`);
console.log(`feature_eligibility: ${eligRows.length} rows`);
console.log(`v2_program_staff assignments: ${programStaff.length}; project_members: ${projectMembers.length}; contact_roles: ${contactRoles.length}`);
console.log("═".repeat(86));

async function simulateUser(label, cid, roleOverride) {
  const contact = contactsMap.get(cid);
  if (!contact) { console.log(`\n### ${label}: UNKNOWN CID ${cid}`); return; }
  const role = roleOverride || contact.role;
  const ctx = await buildCtx(cid, role, data);
  const assignments = data.programStaff.filter((s) => String(s.staff_id) === String(cid));
  const projects = data.projectMembers.filter((p) => String(p.user_cid) === String(cid)).map((p) => p.project_id);
  const progRoles = data.contactRoles.filter((r) => String(r.contact_cid) === String(cid) && r.is_current === true);

  console.log("\n" + "═".repeat(86));
  console.log(`${label} — ${contact.name || cid} <${contact.email || ""}>  role=${role}  status=${contact.status}`);
  console.log(`  profile: ${ctx.profile?.profileSource || "legacy"}${ctx.profile?.profileName ? ` → ${ctx.profile.profileName}` : " (NONE → legacy role_capabilities fallback)"}`);
  console.log(`  eligibility: ${ctx.eligibility ? JSON.stringify(ctx.eligibility) : "(bypass)"}`);
  console.log(`  groups: ${ctx.groups.length ? ctx.groups.join(", ") : "(none)"}`);
  console.log(`  program assignments (v2_program_staff): ${assignments.length ? assignments.map((a) => `${a.program_id}:${a.role}`).join(", ") : "(none)"}`);
  console.log(`  current contact_roles: ${progRoles.length ? progRoles.map((r) => `${r.context_type}:${r.context_id}:${r.role}`).join(", ") : "(none)"}`);
  console.log(`  project memberships: ${projects.length ? projects.join(", ") : "(none)"}`);
  console.log(`  grants: ${Object.keys(ctx.grants).length ? JSON.stringify(ctx.grants) : "none"}`);
  console.log(`  restrictions: ${Object.keys(ctx.restrictions).length ? JSON.stringify([...Object.entries(ctx.restrictions)].map(([m, s]) => [m, [...s]])) : "none"}`);
  const rows = MATRIX.map(([m, c]) => {
    const decision = authorize(ctx, m, c, 1);
    const eff = ctx.effective?.[m]?.[c] ?? 0;
    const fk = MODULE_TO_FEATURE[m];
    const trace = `[fk=${fk} elig=${ctx.eligibility?.[fk]} eff=${eff}]`;
    return `${decision ? "ALLOW" : "DENY "} ${m}.${c} (${fmt(eff)}) ${trace}`;
  });
  console.log("  " + rows.join("\n  "));
}

// ── Representative identities (real production data) ──
await simulateUser("SUPER ADMIN (bypass)", "sa");
await simulateUser("STAFF — default template", "USER_5A1287E33594"); // eddy
await simulateUser("STAFF — restricted (Test)", "USER_5CDE0CE77819"); // Test: grant + restrictions
await simulateUser("PROGRAM MANAGER (user profile override)", "USER_6B8031C5115"); // Josias
await simulateUser("STAFF — project member (Maryse)", "USER_57B31A101731");
// First facilitator found in v2_program_staff
const fac = data.programStaff[0];
if (fac) await simulateUser(`FACILITATOR (assigned to ${fac.program_id})`, fac.staff_id);
// First real participant
const participant = contacts.find((c) => c.role === "participant" && c.status === "active");
if (participant) await simulateUser("PARTICIPANT (representative)", participant.cid);
// Investor if any exist
const investor = contacts.find((c) => c.role === "investor");
if (investor) await simulateUser("INVESTOR", investor.cid);
else console.log("\n### INVESTOR: no production identity — production simulation unavailable (covered by unit tests)");

console.log("\n" + "═".repeat(86));
console.log("VERIFICATION — exact profile + eligibility rows behind the decisions above");

// Staff Default profile capability rows
const staffDefault = data.roleDefaults.get("staff");
const staffProfId = staffDefault?.access_profile_id;
if (staffProfId) {
  console.log(`\nStaff Default profile (${data.profiles.get(staffProfId)?.name}) — ${data.profileCapsByProfile.get(staffProfId)?.length || 0} capability rows:`);
  for (const r of data.profileCapsByProfile.get(staffProfId) || []) console.log(`  ${r.module}.${r.capability} = L${r.access_level}`);
}

// Participant Default profile capability rows
const partDefault = data.roleDefaults.get("participant");
const partProfId = partDefault?.access_profile_id;
if (partProfId) {
  console.log(`\nParticipant Default profile (${data.profiles.get(partProfId)?.name}) — ${data.profileCapsByProfile.get(partProfId)?.length || 0} capability rows:`);
  for (const r of data.profileCapsByProfile.get(partProfId) || []) console.log(`  ${r.module}.${r.capability} = L${r.access_level}`);
}

// Eligibility rows per simulated identity
const showElig = (label, pred) => {
  const rows = data.eligRowsAll.filter(pred);
  console.log(`\n${label} — ${rows.length} feature_eligibility rows:`);
  if (!rows.length) console.log("  (none — every feature fails closed → DENY)");
  for (const r of rows) console.log(`  ${r.feature_key} | ${r.identity_type}:${r.identity_value} | ${r.eligible === 1 ? "eligible" : r.eligible === 0 ? "INELIGIBLE" : "unset"}`);
};
showElig("PARTICIPANT eligibility", (r) => r.identity_type === "role" && r.identity_value === "participant");
showElig("FACILITATOR eligibility", (r) => r.identity_type === "role" && r.identity_value === "facilitator");
showElig("STAFF eligibility", (r) => r.identity_type === "role" && r.identity_value === "staff");

console.log("\n" + "═".repeat(86));
console.log("SIMULATION COMPLETE — read-only, no writes performed.");
process.exit(0);
