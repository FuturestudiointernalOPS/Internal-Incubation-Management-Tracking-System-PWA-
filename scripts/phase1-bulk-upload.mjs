/**
 * STAGING-ONLY — Phase 1 bulk-upload gate migration + founder eligibility row.
 *
 * Step 1 (inventory, read-only): every holder of permissions.assign_capabilities
 *   across access_profile_capabilities / user_capabilities / role_capabilities /
 *   group_capabilities (the legacy gate for /api/admin/bulk-upload).
 * Step 2 (`apply`): additive mapping — each holder source receives a matching
 *   bulk_upload.execute row at the SAME access level (profiles → profile rows,
 *   users → user_capabilities, roles → role_capabilities, groups →
 *   group_capabilities). Legacy rows are NOT deleted or overwritten.
 * Step 3 (`apply`): founder eligibility row ventures|founder (additive,
 *   ON-CONFLICT-safe via existence check).
 * Before-images are written to scratch/ before any write.
 *
 * Usage:
 *   node scripts/phase1-bulk-upload.mjs            (inventory only)
 *   node scripts/phase1-bulk-upload.mjs apply      (inventory + additive apply)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import pg from "pg";

const files = [".env.audit-staging", ".env.staging"];
let url = null;
for (const f of files) {
  try {
    const u = readFileSync(f, "utf-8")
      .split("\n")
      .find((l) => l.startsWith("DATABASE_URL="))
      ?.substring("DATABASE_URL=".length)
      .trim();
    if (u) { url = u; break; }
  } catch { /* next */ }
}
if (!url) { console.error("NO STAGING URL"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
console.log("DB HOST:", new URL(url).host);

const SOURCES = [
  { label: "access_profile_capabilities", sql: `SELECT apc.profile_id, ap.name AS profile_name, apc.module, apc.capability, apc.access_level
      FROM access_profile_capabilities apc LEFT JOIN access_profiles ap ON ap.id = apc.profile_id
      WHERE apc.module='permissions' AND apc.capability='assign_capabilities' ORDER BY apc.profile_id` },
  { label: "user_capabilities", sql: `SELECT user_cid, module, capability, access_level FROM user_capabilities
      WHERE module='permissions' AND capability='assign_capabilities'
        AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY user_cid` },
  { label: "role_capabilities", sql: `SELECT role, module, capability, access_level FROM role_capabilities
      WHERE module='permissions' AND capability='assign_capabilities' ORDER BY role` },
  { label: "group_capabilities", sql: `SELECT group_name, module, capability, access_level FROM group_capabilities
      WHERE module='permissions' AND capability='assign_capabilities' ORDER BY group_name` },
];

try {
  // 1. Inventory
  const inventory = {};
  for (const src of SOURCES) {
    const r = await pool.query(src.sql);
    inventory[src.label] = r.rows;
    console.log(`${src.label}: ${r.rowCount} holder(s)`);
    for (const row of r.rows) console.log("   ", JSON.stringify(row));
  }

  // 2. Founder eligibility row check
  const fe = await pool.query(
    `SELECT id FROM feature_eligibility WHERE feature_key='ventures' AND identity_type='role' AND identity_value='founder'`,
  );
  console.log(`feature_eligibility ventures|founder: ${fe.rowCount ? "PRESENT" : "MISSING (will add on apply)"}`);

  // Before-image
  mkdirSync("scratch", { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const file = `scratch/phase1-bulk-upload-before-${stamp}.json`;
  const snapshot = {};
  for (const src of SOURCES) {
    const all = await pool.query(`SELECT * FROM ${src.label.split("_").length === 2 ? src.label : src.label}`);
    snapshot[src.label] = all.rows;
  }
  snapshot.feature_eligibility_founder = fe.rows;
  writeFileSync(file, JSON.stringify({ host: new URL(url).host, exportedAt: new Date().toISOString(), ...snapshot }, null, 2));
  console.log("before-image:", file);

  if (process.argv[2] !== "apply") {
    console.log("\n(re-run with `apply` to perform the additive mapping)");
    await pool.end();
    process.exit(0);
  }

  // 3. Additive mapping: bulk_upload.execute mirroring each holder
  let added = 0;
  for (const row of inventory.access_profile_capabilities) {
    await pool.query(
      `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
       VALUES ($1,'bulk_upload','execute',$2) ON CONFLICT (profile_id, module, capability) DO NOTHING`,
      [row.profile_id, row.access_level],
    );
    added += 1;
  }
  for (const row of inventory.user_capabilities) {
    await pool.query(
      `INSERT INTO user_capabilities (user_cid, module, capability, access_level, granted_by)
       VALUES ($1,'bulk_upload','execute',$2,'phase1-migration')
       ON CONFLICT (user_cid, module, capability) DO NOTHING`,
      [row.user_cid, row.access_level],
    );
    added += 1;
  }
  for (const row of inventory.role_capabilities) {
    await pool.query(
      `INSERT INTO role_capabilities (role, module, capability, access_level)
       VALUES ($1,'bulk_upload','execute',$2) ON CONFLICT (role, module, capability) DO NOTHING`,
      [row.role, row.access_level],
    );
    added += 1;
  }
  for (const row of inventory.group_capabilities) {
    await pool.query(
      `INSERT INTO group_capabilities (group_name, module, capability, access_level)
       VALUES ($1,'bulk_upload','execute',$2) ON CONFLICT (group_name, module, capability) DO NOTHING`,
      [row.group_name, row.access_level],
    );
    added += 1;
  }
  console.log(`\napplied ${added} bulk_upload.execute mapping row(s)`);

  // 4. Founder eligibility row (additive)
  if (fe.rowCount === 0) {
    await pool.query(
      `INSERT INTO feature_eligibility (feature_key, identity_type, identity_value, eligible, created_at)
       VALUES ('ventures','role','founder',1,NOW())`,
    );
    console.log("added feature_eligibility ventures|founder");
  } else {
    console.log("feature_eligibility ventures|founder already present — untouched");
  }
  console.log("rollback source:", file);
} finally {
  await pool.end();
}
