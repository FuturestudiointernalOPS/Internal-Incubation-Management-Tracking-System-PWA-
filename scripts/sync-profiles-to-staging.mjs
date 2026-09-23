/**
 * Sync production access profiles + capabilities + role defaults into STAGING.
 * Production is READ-ONLY. Staging profiles are created/updated by name
 * (idempotent). Existing staging-only profiles (e.g. "Staff") are left intact.
 *
 * Usage: node scripts/sync-profiles-to-staging.mjs
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const readDatabaseUrl = (file) => {
  try {
    return readFileSync(file, "utf-8")
      .split("\n")
      .find((envLine) => envLine.startsWith("DATABASE_URL="))
      ?.substring("DATABASE_URL=".length)
      .trim();
  } catch {
    return null;
  }
};

const prodUrl = readDatabaseUrl(".env.local") || readDatabaseUrl(".env.prod-verify");
const stageUrl = readDatabaseUrl(".env.audit-staging") || readDatabaseUrl(".env.staging");
if (!prodUrl || !stageUrl) {
  console.error("Missing production or staging env file");
  process.exit(2);
}
const prod = new pg.Pool({ connectionString: prodUrl, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
const stage = new pg.Pool({ connectionString: stageUrl, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
await prod.query("SELECT 1");
await stage.query("SELECT 1");
console.log("[sync] production + staging connected (production read-only)");

// 1. Read production profiles, caps, role defaults
const productionProfiles = (await prod.query("SELECT id, name, description, is_active FROM access_profiles ORDER BY name")).rows;
const productionCapabilities = (await prod.query("SELECT profile_id, module, capability, access_level FROM access_profile_capabilities ORDER BY profile_id, module, capability")).rows;
const productionRoleDefaults = (await prod.query("SELECT role_name, access_profile_id FROM role_access_profile_defaults ORDER BY role_name")).rows;
const profileById = new Map(productionProfiles.map((profile) => [profile.id, profile]));
const profileByName = new Map(productionProfiles.map((profile) => [profile.name, profile]));
console.log(`[sync] production: ${productionProfiles.length} profiles, ${productionCapabilities.length} cap rows, ${productionRoleDefaults.length} role defaults`);

// 2. Upsert profiles into staging by NAME (keep staging-only profiles)
const nameToStageId = new Map();
for (const profile of productionProfiles) {
  const insertResult = await stage.query(
    `INSERT INTO access_profiles (name, description, is_active)
     VALUES ($1, $2, $3)
     ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, is_active = EXCLUDED.is_active
     RETURNING id`,
    [profile.name, profile.description || "", profile.is_active],
  );
  nameToStageId.set(profile.name, insertResult.rows[0].id);
}
console.log(`[sync] upserted ${productionProfiles.length} profiles into staging`);

// 3. Copy capabilities (replace-match per synced profile: delete stale staging
//    rows that production no longer has, then upsert production's rows)
let capCount = 0;
for (const [name, stageId] of nameToStageId) {
  const productionCaps = productionCapabilities.filter((capability) => capability.profile_id === profileByName.get(name)?.id);
  // Remove staging caps for this profile that do not exist in production
  const prodKeys = new Set(productionCaps.map((capability) => `${capability.module}\u0000${capability.capability}`));
  const stagingRows = (
    await stage.query(
      "SELECT id, module, capability FROM access_profile_capabilities WHERE profile_id = $1",
      [stageId],
    )
  ).rows;
  for (const row of stagingRows) {
    if (!prodKeys.has(`${row.module}\u0000${row.capability}`)) {
      await stage.query("DELETE FROM access_profile_capabilities WHERE id = $1", [row.id]);
    }
  }
  for (const capability of productionCaps) {
    await stage.query(
      `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (profile_id, module, capability) DO UPDATE SET access_level = EXCLUDED.access_level`,
      [stageId, capability.module, capability.capability, capability.access_level],
    );
    capCount++;
  }
}
console.log(`[sync] copied ${capCount} capability rows (replace-match per profile)`);

// 4. Role defaults -> point at the staging profile with the same name
for (const roleDefault of productionRoleDefaults) {
  const target = nameToStageId.get(profileById.get(roleDefault.access_profile_id)?.name);
  if (!target) continue;
  await stage.query(
    `INSERT INTO role_access_profile_defaults (role_name, access_profile_id)
     VALUES ($1, $2)
     ON CONFLICT (role_name) DO UPDATE SET access_profile_id = EXCLUDED.access_profile_id`,
    [roleDefault.role_name, target],
  );
}
console.log(`[sync] synced ${productionRoleDefaults.length} role defaults`);

// 5. Audit entry in staging
await stage.query(
  `INSERT INTO permission_audit_log (actor_cid, actor_name, target_cid, target_name, action, details)
   VALUES ('system', 'system', 'system', 'profile-sync', 'profiles_synced',
           'Synced production profiles/capabilities/role-defaults into staging')`,
);
console.log("[sync] audit entry recorded");

// 6. Report staging final state
const stagingProfiles = (await stage.query("SELECT id, name, is_active FROM access_profiles ORDER BY name")).rows;
const stagingCapabilityCount = (await stage.query("SELECT count(*) AS n FROM access_profile_capabilities")).rows[0].n;
const stagingRoleDefaults = (await stage.query("SELECT role_name, access_profile_id FROM role_access_profile_defaults ORDER BY role_name")).rows;
console.log("\n=== STAGING FINAL STATE ===");
for (const profile of stagingProfiles) console.log(`  #${profile.id} ${profile.name}${profile.is_active ? "" : " (inactive)"}`);
console.log(`  total capability rows: ${stagingCapabilityCount}`);
for (const roleDefault of stagingRoleDefaults) {
  const name = stagingProfiles.find((profile) => profile.id === roleDefault.access_profile_id)?.name || roleDefault.access_profile_id;
  console.log(`  ${roleDefault.role_name} → ${name}`);
}

await prod.end();
await stage.end();
console.log("\n[sync] done — production untouched, staging updated");
process.exit(0);
