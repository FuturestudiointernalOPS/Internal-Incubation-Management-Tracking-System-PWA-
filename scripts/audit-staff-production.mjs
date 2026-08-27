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
    const probe = await import("pg");
    const pool = new probe.default.Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    await pool.query("SELECT 1");
    await pool.end();
    process.env.DATABASE_URL = url;
    console.log(`[audit] connected via ${file}`);
    break;
  } catch {}
}

const { initDb } = await import("../src/lib/db.js");
const { rowsToCaps, rowsToRestrictions, mergeEffectiveCapabilities } =
  await import("../src/lib/authorization/index.js");
const { MODULE_TO_FEATURE, FEATURE_ELIGIBILITY_DEFAULTS, evaluateEligibility } =
  await import("../src/lib/authorization/eligibility.js");
const { PERMISSION_MODULES } = await import("../src/lib/auth.js");

// Proposed Phase 3 template (for comparison only — NOT applied)
const PROPOSED_TEMPLATE = {
  messaging: { view: 1, send: 2 },
  reports: { create: 2 },
};

const db = await initDb();
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;

const [contacts, staffUsers, grants, restrictions, profiles, roleDefaults, profileCaps, eligRows] =
  await Promise.all([
    q("SELECT cid, access_profile_id, group_name, role FROM contacts"),
    q("SELECT cid, name, email, role, group_name FROM contacts WHERE role = 'staff' AND deleted_at IS NULL ORDER BY name"),
    q("SELECT user_cid, module, capability, access_level FROM user_capabilities WHERE (expires_at IS NULL OR expires_at > NOW())"),
    q("SELECT user_cid, module, capability FROM user_capability_restrictions WHERE (expires_at IS NULL OR expires_at > NOW())"),
    q("SELECT id, name, is_active FROM access_profiles ORDER BY id"),
    q("SELECT rpd.role_name, rpd.access_profile_id, ap.name FROM role_access_profile_defaults rpd JOIN access_profiles ap ON ap.id = rpd.access_profile_id"),
    q("SELECT profile_id, module, capability, access_level FROM access_profile_capabilities ORDER BY profile_id, module, capability"),
    q("SELECT feature_key, identity_type, identity_value, eligible FROM feature_eligibility"),
  ]);

const staffCids = new Set(staffUsers.map((u) => u.cid));
const grantsBy = (cid) => grants.filter((g) => g.user_cid === cid);
const restrictsBy = (cid) => restrictions.filter((r) => r.user_cid === cid);
const profileById = (id) => profiles.find((p) => p.id === id);
const staffProfileId = roleDefaults.find((r) => r.role_name === "staff")?.access_profile_id;
const staffProfile = profileById(staffProfileId);

console.log("=".repeat(78));
console.log("1. STAFF ELIGIBILITY BY FEATURE (feature_eligibility, role=staff)");
console.log("=".repeat(78));
const staffElig = eligRows.filter((r) => r.identity_type === "role" && r.identity_value === "staff");
for (const r of staffElig) console.log(`  ${r.feature_key} = ${Number(r.eligible) === 1 ? "ELIGIBLE" : "DENIED"}`);
console.log(`  (${staffElig.length} rows)`);

console.log("\n" + "=".repeat(78));
console.log("2. STAFF DEFAULT PROFILE (every capability inside it)");
console.log("=".repeat(78));
console.log(`  Profile: ${staffProfile?.name} (id=${staffProfileId}, active=${staffProfile?.is_active})`);
const staffProfileCaps = profileCaps.filter((c) => c.profile_id === staffProfileId);
for (const c of staffProfileCaps) console.log(`  ${c.module}.${c.capability} = level ${c.access_level}`);
console.log(`  TOTAL: ${staffProfileCaps.length} capabilities`);

console.log("\n" + "=".repeat(78));
console.log("3+4. INDIVIDUAL GRANTS / RESTRICTIONS PER STAFF USER");
console.log("=".repeat(78));
for (const u of staffUsers) {
  const g = grantsBy(u.cid);
  const r = restrictsBy(u.cid);
  console.log(`\n  ${u.name} <${u.email}> (${u.cid}) — group="${u.group_name || ""}"`);
  console.log(`    grants: ${g.length ? g.map((x) => `${x.module}.${x.capability}=${x.access_level}`).join(", ") : "(none)"}`);
  console.log(`    restrictions: ${r.length ? r.map((x) => `${x.module}.${x.capability}`).join(", ") : "(none)"}`);
}

console.log("\n" + "=".repeat(78));
console.log("5. EFFECTIVE PERMISSIONS PER STAFF USER (profile base + grants − restrictions)");
console.log("=".repeat(78));
for (const u of staffUsers) {
  const base = rowsToCaps(staffProfileCaps);
  const g = rowsToCaps(grantsBy(u.cid));
  const r = rowsToRestrictions(restrictsBy(u.cid));
  const effective = mergeEffectiveCapabilities(base, {}, g, r);
  console.log(`\n  ${u.name} <${u.email}>`);
  for (const [mod, caps] of Object.entries(effective)) {
    if (Object.keys(caps).length === 0) continue;
    console.log(`    ${mod}: ${Object.entries(caps).map(([c, l]) => `${c}=${l}`).join(", ")}`);
  }
}

console.log("\n" + "=".repeat(78));
console.log("6. CAPABILITIES GRANTED AS DEFAULT THAT SHOULD NOT BE (per new model)");
console.log("=".repeat(78));
const extraCaps = staffProfileCaps.filter(
  (c) => !(PROPOSED_TEMPLATE[c.module] && PROPOSED_TEMPLATE[c.module][c.capability] !== undefined),
);
for (const c of extraCaps) console.log(`  ${c.module}.${c.capability} (level ${c.access_level})`);
console.log(`  TOTAL: ${extraCaps.length} (would be removed from the template under the minimal model)`);

console.log("\n" + "=".repeat(78));
console.log("7. ELIGIBLE BUT NOT RECEIVED BY DEFAULT");
console.log("=".repeat(78));
const eligibleFeatures = new Set(staffElig.filter((r) => Number(r.eligible) === 1).map((r) => r.feature_key));
const profileCapsSet = new Set(staffProfileCaps.map((c) => `${c.module}.${c.capability}`));
const missing = [];
for (const [mod, def] of Object.entries(PERMISSION_MODULES)) {
  const feature = MODULE_TO_FEATURE[mod];
  if (!feature || !eligibleFeatures.has(feature)) continue;
  for (const cap of def.capabilities) {
    if (!profileCapsSet.has(`${mod}.${cap}`)) missing.push(`${mod}.${cap} (feature: ${feature})`);
  }
}
for (const m of missing) console.log(`  ${m}`);
console.log(`  TOTAL: ${missing.length} capabilities (assignable via Individual Access, not default)`);

console.log("\n" + "=".repeat(78));
console.log("DONE — read-only. No changes were made.");
console.log("=".repeat(78));
process.exit(0);
