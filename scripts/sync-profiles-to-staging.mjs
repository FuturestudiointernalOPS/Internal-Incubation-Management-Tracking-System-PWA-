/**
 * Sync production access profiles + capabilities + role defaults into STAGING.
 * Production is READ-ONLY. Staging profiles are created/updated by name
 * (idempotent). Existing staging-only profiles (e.g. "Staff") are left intact.
 *
 * Usage: node scripts/sync-profiles-to-staging.mjs
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const readUrl = (file) => {
  try {
    return readFileSync(file, "utf-8")
      .split("\n")
      .find((l) => l.startsWith("DATABASE_URL="))
      ?.substring("DATABASE_URL=".length)
      .trim();
  } catch {
    return null;
  }
};

const prodUrl = readUrl(".env.local") || readUrl(".env.prod-verify");
const stageUrl = readUrl(".env.audit-staging") || readUrl(".env.staging");
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
const profRows = (await prod.query("SELECT id, name, description, is_active FROM access_profiles ORDER BY name")).rows;
const capRows = (await prod.query("SELECT profile_id, module, capability, access_level FROM access_profile_capabilities ORDER BY profile_id, module, capability")).rows;
const defRows = (await prod.query("SELECT role_name, access_profile_id FROM role_access_profile_defaults ORDER BY role_name")).rows;
const profById = new Map(profRows.map((p) => [p.id, p]));
const profByName = new Map(profRows.map((p) => [p.name, p]));
console.log(`[sync] production: ${profRows.length} profiles, ${capRows.length} cap rows, ${defRows.length} role defaults`);

// 2. Upsert profiles into staging by NAME (keep staging-only profiles)
const nameToStageId = new Map();
for (const p of profRows) {
  const ins = await stage.query(
    `INSERT INTO access_profiles (name, description, is_active)
     VALUES ($1, $2, $3)
     ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, is_active = EXCLUDED.is_active
     RETURNING id`,
    [p.name, p.description || "", p.is_active],
  );
  nameToStageId.set(p.name, ins.rows[0].id);
}
console.log(`[sync] upserted ${profRows.length} profiles into staging`);

// 3. Copy capabilities (replace-match per synced profile: delete stale staging
//    rows that production no longer has, then upsert production's rows)
let capCount = 0;
for (const [name, stageId] of nameToStageId) {
  const prodCaps = capRows.filter((c) => c.profile_id === profByName.get(name)?.id);
  // Remove staging caps for this profile that do not exist in production
  const prodKeys = new Set(prodCaps.map((c) => `${c.module}\u0000${c.capability}`));
  const stRows = (
    await stage.query(
      "SELECT id, module, capability FROM access_profile_capabilities WHERE profile_id = $1",
      [stageId],
    )
  ).rows;
  for (const row of stRows) {
    if (!prodKeys.has(`${row.module}\u0000${row.capability}`)) {
      await stage.query("DELETE FROM access_profile_capabilities WHERE id = $1", [row.id]);
    }
  }
  for (const c of prodCaps) {
    await stage.query(
      `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (profile_id, module, capability) DO UPDATE SET access_level = EXCLUDED.access_level`,
      [stageId, c.module, c.capability, c.access_level],
    );
    capCount++;
  }
}
console.log(`[sync] copied ${capCount} capability rows (replace-match per profile)`);

// 4. Role defaults -> point at the staging profile with the same name
for (const d of defRows) {
  const target = nameToStageId.get(profById.get(d.access_profile_id)?.name);
  if (!target) continue;
  await stage.query(
    `INSERT INTO role_access_profile_defaults (role_name, access_profile_id)
     VALUES ($1, $2)
     ON CONFLICT (role_name) DO UPDATE SET access_profile_id = EXCLUDED.access_profile_id`,
    [d.role_name, target],
  );
}
console.log(`[sync] synced ${defRows.length} role defaults`);

// 5. Audit entry in staging
await stage.query(
  `INSERT INTO permission_audit_log (actor_cid, actor_name, target_cid, target_name, action, details)
   VALUES ('system', 'system', 'system', 'profile-sync', 'profiles_synced',
           'Synced production profiles/capabilities/role-defaults into staging')`,
);
console.log("[sync] audit entry recorded");

// 6. Report staging final state
const stProfiles = (await stage.query("SELECT id, name, is_active FROM access_profiles ORDER BY name")).rows;
const stCaps = (await stage.query("SELECT count(*) AS n FROM access_profile_capabilities")).rows[0].n;
const stDefs = (await stage.query("SELECT role_name, access_profile_id FROM role_access_profile_defaults ORDER BY role_name")).rows;
console.log("\n=== STAGING FINAL STATE ===");
for (const p of stProfiles) console.log(`  #${p.id} ${p.name}${p.is_active ? "" : " (inactive)"}`);
console.log(`  total capability rows: ${stCaps}`);
for (const d of stDefs) {
  const name = stProfiles.find((p) => p.id === d.access_profile_id)?.name || d.access_profile_id;
  console.log(`  ${d.role_name} → ${name}`);
}

await prod.end();
await stage.end();
console.log("\n[sync] done — production untouched, staging updated");
process.exit(0);
