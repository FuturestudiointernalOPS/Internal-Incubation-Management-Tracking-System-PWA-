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
    const pgModule = await import("pg");
    const probePool = new pgModule.default.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
    await probePool.query("SELECT 1");
    await probePool.end();
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
const runQuery = async (sql) => (await db.execute({ sql, args: [] })).rows;

const [contacts, grants, restrictions, profiles, roleDefaults, profileCaps, roleCaps, userGroups, groupCaps, eligRows, programStaff, projectMembers, contactRoles] =
  await Promise.all([
    runQuery("SELECT cid, name, email, role, access_profile_id, group_name, status FROM contacts"),
    runQuery("SELECT user_cid, module, capability, access_level FROM user_capabilities WHERE (expires_at IS NULL OR expires_at > NOW())"),
    runQuery("SELECT user_cid, module, capability FROM user_capability_restrictions WHERE (expires_at IS NULL OR expires_at > NOW())"),
    runQuery("SELECT id, name, is_active FROM access_profiles"),
    runQuery("SELECT role_name, access_profile_id FROM role_access_profile_defaults"),
    runQuery("SELECT profile_id, module, capability, access_level FROM access_profile_capabilities"),
    runQuery("SELECT role, module, capability, access_level FROM role_capabilities"),
    runQuery("SELECT user_cid, group_name FROM user_groups"),
    runQuery("SELECT group_name, module, capability, access_level FROM group_capabilities"),
    runQuery("SELECT feature_key, identity_type, identity_value, eligible FROM feature_eligibility"),
    runQuery("SELECT program_id, staff_id, role, permissions FROM v2_program_staff"),
    runQuery("SELECT project_id, user_cid FROM project_members"),
    runQuery("SELECT contact_cid, context_type, context_id, role, is_current FROM contact_roles"),
  ]);

const contactsMap = new Map(contacts.map((contact) => [contact.cid, contact]));
const groupBy = (rows, key) => {
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row[key])) grouped.set(row[key], []);
    grouped.get(row[key]).push(row);
  }
  return grouped;
};
const data = {
  contactsMap,
  grantsByUser: groupBy(grants, "user_cid"),
  restrictionsByUser: groupBy(restrictions, "user_cid"),
  profiles: new Map(profiles.map((profile) => [profile.id, profile])),
  roleDefaults: new Map(roleDefaults.map((roleDefault) => [roleDefault.role_name, roleDefault])),
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
    const superAdminCaps = {};
    for (const [module, moduleDef] of Object.entries(PERMISSION_MODULES)) {
      superAdminCaps[module] = {};
      for (const capability of moduleDef.capabilities) superAdminCaps[module][capability] = ACCESS_LEVELS.FULL;
    }
    return { cid, role, isSuperAdmin: true, groups: [], profile: null, eligibility: null, baseCaps: superAdminCaps, groupCaps: {}, effective: mergeEffectiveCapabilities(superAdminCaps, {}, grants, restrictions), grants, restrictions };
  }
  const contact = data.contactsMap.get(cid) || {};
  // Profile resolution — mirrors resolveAuthorizationContext exactly:
  // user override → role default (active profile only) → legacy fallback.
  let profileId = null, profileName = null, profileSource = "legacy";
  if (contact.access_profile_id) {
    const profile = data.profiles.get(contact.access_profile_id);
    if (profile && Number(profile.is_active) === 1) { profileId = profile.id; profileName = profile.name; profileSource = "user"; }
  }
  if (!profileId && role) {
    const roleDefault = data.roleDefaults.get(role);
    const profile = roleDefault && data.profiles.get(roleDefault.access_profile_id);
    if (profile && Number(profile.is_active) === 1) { profileId = profile.id; profileName = profile.name; profileSource = "role"; }
  }
  let baseCaps;
  if (profileId) baseCaps = rowsToCaps(data.profileCapsByProfile.get(profileId) || []);
  else baseCaps = rowsToCaps(data.roleCapsByRole.get(role) || []);
  const groups = await getEffectiveGroupsForUser(cid);
  const groupCaps = groups.length > 0 ? rowsToCaps(groups.flatMap((group) => data.groupCapsByGroup.get(group) || [])) : {};
  const eligRows = data.eligRowsAll.filter(
    (eligibilityRow) => (eligibilityRow.identity_type === "role" && eligibilityRow.identity_value === role) || (eligibilityRow.identity_type === "group" && groups.includes(eligibilityRow.identity_value)),
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

const fmt = (level) => (level ? `L${level}` : "—");

// ── Configuration summary (role defaults, profiles, group caps, eligibility rows) ──
console.log("═".repeat(86));
console.log("CONFIGURATION SNAPSHOT (read-only)");
console.log(`access_profiles: ${profiles.length} — ${profiles.map((profile) => `${profile.name}${Number(profile.is_active) === 1 ? "" : " (inactive)"}`).join(", ")}`);
console.log(
  `role_access_profile_defaults: ${roleDefaults.length} — ${roleDefaults
    .map((roleDefault) => `${roleDefault.role_name} → ${data.profiles.get(roleDefault.access_profile_id)?.name || roleDefault.access_profile_id}`)
    .join(", ")}`,
);
const roleCapsCount = new Map();
for (const capabilityRow of roleCaps) roleCapsCount.set(capabilityRow.role, (roleCapsCount.get(capabilityRow.role) || 0) + 1);
console.log(`role_capabilities (legacy fallback) rows per role: ${[...roleCapsCount.entries()].map(([role, count]) => `${role}:${count}`).join(", ")}`);
console.log(`group_capabilities: ${groupCaps.length} rows — groups: ${[...new Set(groupCaps.map((groupCap) => groupCap.group_name))].join(", ")}`);
console.log(`feature_eligibility: ${eligRows.length} rows`);
console.log(`v2_program_staff assignments: ${programStaff.length}; project_members: ${projectMembers.length}; contact_roles: ${contactRoles.length}`);
console.log("═".repeat(86));

async function simulateUser(label, cid, roleOverride) {
  const contact = contactsMap.get(cid);
  if (!contact) { console.log(`\n### ${label}: UNKNOWN CID ${cid}`); return; }
  const role = roleOverride || contact.role;
  const ctx = await buildCtx(cid, role, data);
  const assignments = data.programStaff.filter((assignment) => String(assignment.staff_id) === String(cid));
  const projects = data.projectMembers.filter((member) => String(member.user_cid) === String(cid)).map((member) => member.project_id);
  const progRoles = data.contactRoles.filter((contactRole) => String(contactRole.contact_cid) === String(cid) && contactRole.is_current === true);

  console.log("\n" + "═".repeat(86));
  console.log(`${label} — ${contact.name || cid} <${contact.email || ""}>  role=${role}  status=${contact.status}`);
  console.log(`  profile: ${ctx.profile?.profileSource || "legacy"}${ctx.profile?.profileName ? ` → ${ctx.profile.profileName}` : " (NONE → legacy role_capabilities fallback)"}`);
  console.log(`  eligibility: ${ctx.eligibility ? JSON.stringify(ctx.eligibility) : "(bypass)"}`);
  console.log(`  groups: ${ctx.groups.length ? ctx.groups.join(", ") : "(none)"}`);
  console.log(`  program assignments (v2_program_staff): ${assignments.length ? assignments.map((assignment) => `${assignment.program_id}:${assignment.role}`).join(", ") : "(none)"}`);
  console.log(`  current contact_roles: ${progRoles.length ? progRoles.map((contactRole) => `${contactRole.context_type}:${contactRole.context_id}:${contactRole.role}`).join(", ") : "(none)"}`);
  console.log(`  project memberships: ${projects.length ? projects.join(", ") : "(none)"}`);
  console.log(`  grants: ${Object.keys(ctx.grants).length ? JSON.stringify(ctx.grants) : "none"}`);
  console.log(`  restrictions: ${Object.keys(ctx.restrictions).length ? JSON.stringify([...Object.entries(ctx.restrictions)].map(([module, deniedSet]) => [module, [...deniedSet]])) : "none"}`);
  const rows = MATRIX.map(([module, capability]) => {
    const decision = authorize(ctx, module, capability, 1);
    const eff = ctx.effective?.[module]?.[capability] ?? 0;
    const featureKey = MODULE_TO_FEATURE[module];
    const trace = `[fk=${featureKey} elig=${ctx.eligibility?.[featureKey]} eff=${eff}]`;
    return `${decision ? "ALLOW" : "DENY "} ${module}.${capability} (${fmt(eff)}) ${trace}`;
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
const facilitator = data.programStaff[0];
if (facilitator) await simulateUser(`FACILITATOR (assigned to ${facilitator.program_id})`, facilitator.staff_id);
// First real participant
const participant = contacts.find((contact) => contact.role === "participant" && contact.status === "active");
if (participant) await simulateUser("PARTICIPANT (representative)", participant.cid);
// Investor if any exist
const investor = contacts.find((contact) => contact.role === "investor");
if (investor) await simulateUser("INVESTOR", investor.cid);
else console.log("\n### INVESTOR: no production identity — production simulation unavailable (covered by unit tests)");

console.log("\n" + "═".repeat(86));
console.log("VERIFICATION — exact profile + eligibility rows behind the decisions above");

// Staff Default profile capability rows
const staffDefault = data.roleDefaults.get("staff");
const staffProfileId = staffDefault?.access_profile_id;
if (staffProfileId) {
  console.log(`\nStaff Default profile (${data.profiles.get(staffProfileId)?.name}) — ${data.profileCapsByProfile.get(staffProfileId)?.length || 0} capability rows:`);
  for (const capabilityRow of data.profileCapsByProfile.get(staffProfileId) || []) console.log(`  ${capabilityRow.module}.${capabilityRow.capability} = L${capabilityRow.access_level}`);
}

// Participant Default profile capability rows
const partDefault = data.roleDefaults.get("participant");
const partProfileId = partDefault?.access_profile_id;
if (partProfileId) {
  console.log(`\nParticipant Default profile (${data.profiles.get(partProfileId)?.name}) — ${data.profileCapsByProfile.get(partProfileId)?.length || 0} capability rows:`);
  for (const capabilityRow of data.profileCapsByProfile.get(partProfileId) || []) console.log(`  ${capabilityRow.module}.${capabilityRow.capability} = L${capabilityRow.access_level}`);
}

// Eligibility rows per simulated identity
const showElig = (label, predicate) => {
  const rows = data.eligRowsAll.filter(predicate);
  console.log(`\n${label} — ${rows.length} feature_eligibility rows:`);
  if (!rows.length) console.log("  (none — every feature fails closed → DENY)");
  for (const eligibilityRow of rows) console.log(`  ${eligibilityRow.feature_key} | ${eligibilityRow.identity_type}:${eligibilityRow.identity_value} | ${eligibilityRow.eligible === 1 ? "eligible" : eligibilityRow.eligible === 0 ? "INELIGIBLE" : "unset"}`);
};
showElig("PARTICIPANT eligibility", (eligibilityRow) => eligibilityRow.identity_type === "role" && eligibilityRow.identity_value === "participant");
showElig("FACILITATOR eligibility", (eligibilityRow) => eligibilityRow.identity_type === "role" && eligibilityRow.identity_value === "facilitator");
showElig("STAFF eligibility", (eligibilityRow) => eligibilityRow.identity_type === "role" && eligibilityRow.identity_value === "staff");

console.log("\n" + "═".repeat(86));
console.log("SIMULATION COMPLETE — read-only, no writes performed.");
process.exit(0);
