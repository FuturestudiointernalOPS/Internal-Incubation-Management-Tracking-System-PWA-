/**
 * PHASE 3 — READ-ONLY STAFF AUTHORIZATION AUDIT (production)
 *
 * Complete Staff report per the audit checklist:
 *   1. Staff eligibility by feature
 *   2. Staff Default profile + every capability inside it
 *   3. Individual grants per Staff user
 *   4. Restrictions per Staff user
 *   5. Effective permissions per Staff user
 *   6. Capabilities granted as default that should not be under the new model
 *   7. Capabilities eligible but NOT received by default
 *
 * Run: node scripts/audit-staff-production.mjs
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
    const probePool = new pgModule.default.Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    await probePool.query("SELECT 1");
    await probePool.end();
    process.env.DATABASE_URL = url;
    console.log(`[audit] connected via ${file}`);
    break;
  } catch {}
}

const { initDb } = await import("../src/lib/db.js");
const { rowsToCaps, rowsToRestrictions, mergeEffectiveCapabilities } =
  await import("../src/lib/authorization/index.js");
const { MODULE_TO_FEATURE } =
  await import("../src/lib/authorization/eligibility.js");
const { PERMISSION_MODULES } = await import("../src/lib/auth.js");

// Proposed Phase 3 template (for comparison only — NOT applied)
const PROPOSED_TEMPLATE = {
  messaging: { view: 1, send: 2 },
  reports: { create: 2 },
};

const db = await initDb();
const runQuery = async (sql, args = []) => (await db.execute({ sql, args })).rows;

const [, staffUsers, grants, restrictions, profiles, roleDefaults, profileCaps, eligRows] =
  await Promise.all([
    runQuery("SELECT cid, access_profile_id, group_name, role FROM contacts"),
    runQuery("SELECT cid, name, email, role, group_name FROM contacts WHERE role = 'staff' AND deleted_at IS NULL ORDER BY name"),
    runQuery("SELECT user_cid, module, capability, access_level FROM user_capabilities WHERE (expires_at IS NULL OR expires_at > NOW())"),
    runQuery("SELECT user_cid, module, capability FROM user_capability_restrictions WHERE (expires_at IS NULL OR expires_at > NOW())"),
    runQuery("SELECT id, name, is_active FROM access_profiles ORDER BY id"),
    runQuery("SELECT rpd.role_name, rpd.access_profile_id, ap.name FROM role_access_profile_defaults rpd JOIN access_profiles ap ON ap.id = rpd.access_profile_id"),
    runQuery("SELECT profile_id, module, capability, access_level FROM access_profile_capabilities ORDER BY profile_id, module, capability"),
    runQuery("SELECT feature_key, identity_type, identity_value, eligible FROM feature_eligibility"),
  ]);

const grantsBy = (cid) => grants.filter((grant) => grant.user_cid === cid);
const restrictsBy = (cid) => restrictions.filter((restriction) => restriction.user_cid === cid);
const profileById = (id) => profiles.find((profile) => profile.id === id);
const staffProfileId = roleDefaults.find((roleDefault) => roleDefault.role_name === "staff")?.access_profile_id;
const staffProfile = profileById(staffProfileId);

console.log("=".repeat(78));
console.log("1. STAFF ELIGIBILITY BY FEATURE (feature_eligibility, role=staff)");
console.log("=".repeat(78));
const staffElig = eligRows.filter((eligibilityRow) => eligibilityRow.identity_type === "role" && eligibilityRow.identity_value === "staff");
for (const eligibilityRow of staffElig) console.log(`  ${eligibilityRow.feature_key} = ${Number(eligibilityRow.eligible) === 1 ? "ELIGIBLE" : "DENIED"}`);
console.log(`  (${staffElig.length} rows)`);

console.log("\n" + "=".repeat(78));
console.log("2. STAFF DEFAULT PROFILE (every capability inside it)");
console.log("=".repeat(78));
console.log(`  Profile: ${staffProfile?.name} (id=${staffProfileId}, active=${staffProfile?.is_active})`);
const staffProfileCaps = profileCaps.filter((capability) => capability.profile_id === staffProfileId);
for (const capability of staffProfileCaps) console.log(`  ${capability.module}.${capability.capability} = level ${capability.access_level}`);
console.log(`  TOTAL: ${staffProfileCaps.length} capabilities`);

console.log("\n" + "=".repeat(78));
console.log("3+4. INDIVIDUAL GRANTS / RESTRICTIONS PER STAFF USER");
console.log("=".repeat(78));
for (const staffUser of staffUsers) {
  const userGrants = grantsBy(staffUser.cid);
  const userRestrictions = restrictsBy(staffUser.cid);
  console.log(`\n  ${staffUser.name} <${staffUser.email}> (${staffUser.cid}) — group="${staffUser.group_name || ""}"`);
  console.log(`    grants: ${userGrants.length ? userGrants.map((grant) => `${grant.module}.${grant.capability}=${grant.access_level}`).join(", ") : "(none)"}`);
  console.log(`    restrictions: ${userRestrictions.length ? userRestrictions.map((restriction) => `${restriction.module}.${restriction.capability}`).join(", ") : "(none)"}`);
}

console.log("\n" + "=".repeat(78));
console.log("5. EFFECTIVE PERMISSIONS PER STAFF USER (profile base + grants − restrictions)");
console.log("=".repeat(78));
for (const staffUser of staffUsers) {
  const base = rowsToCaps(staffProfileCaps);
  const userGrants = rowsToCaps(grantsBy(staffUser.cid));
  const userRestrictions = rowsToRestrictions(restrictsBy(staffUser.cid));
  const effective = mergeEffectiveCapabilities(base, {}, userGrants, userRestrictions);
  console.log(`\n  ${staffUser.name} <${staffUser.email}>`);
  for (const [module, capabilities] of Object.entries(effective)) {
    if (Object.keys(capabilities).length === 0) continue;
    console.log(`    ${module}: ${Object.entries(capabilities).map(([capability, level]) => `${capability}=${level}`).join(", ")}`);
  }
}

console.log("\n" + "=".repeat(78));
console.log("6. CAPABILITIES GRANTED AS DEFAULT THAT SHOULD NOT BE (per new model)");
console.log("=".repeat(78));
const extraCaps = staffProfileCaps.filter(
  (capability) => !(PROPOSED_TEMPLATE[capability.module] && PROPOSED_TEMPLATE[capability.module][capability.capability] !== undefined),
);
for (const capability of extraCaps) console.log(`  ${capability.module}.${capability.capability} (level ${capability.access_level})`);
console.log(`  TOTAL: ${extraCaps.length} (would be removed from the template under the minimal model)`);

console.log("\n" + "=".repeat(78));
console.log("7. ELIGIBLE BUT NOT RECEIVED BY DEFAULT");
console.log("=".repeat(78));
const eligibleFeatures = new Set(staffElig.filter((eligibilityRow) => Number(eligibilityRow.eligible) === 1).map((eligibilityRow) => eligibilityRow.feature_key));
const profileCapsSet = new Set(staffProfileCaps.map((capability) => `${capability.module}.${capability.capability}`));
const missing = [];
for (const [module, moduleDef] of Object.entries(PERMISSION_MODULES)) {
  const feature = MODULE_TO_FEATURE[module];
  if (!feature || !eligibleFeatures.has(feature)) continue;
  for (const capability of moduleDef.capabilities) {
    if (!profileCapsSet.has(`${module}.${capability}`)) missing.push(`${module}.${capability} (feature: ${feature})`);
  }
}
for (const missingCapability of missing) console.log(`  ${missingCapability}`);
console.log(`  TOTAL: ${missing.length} capabilities (assignable via Individual Access, not default)`);

console.log("\n" + "=".repeat(78));
console.log("DONE — read-only. No changes were made.");
console.log("=".repeat(78));
process.exit(0);
