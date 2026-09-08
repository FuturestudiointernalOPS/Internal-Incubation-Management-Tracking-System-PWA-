/**
 * Phase 2 configuration — PRODUCTION and STAGING.
 * 1. Add 4 eligibility rows (staff→Access/Security, participant→Programs, investor→Ventures).
 *    Additive only — no access is granted by eligibility alone (profiles/grants still gate).
 * 2. Rename profile "Mentor" → "Investor Access" (label fix; investor default already points here).
 * 3. Audit entries in production.
 * Idempotent: ON CONFLICT DO NOTHING / rename only when the old name exists.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const readUrl = (f) =>
  readFileSync(f, "utf-8")
    .split("\n")
    .find((l) => l.startsWith("DATABASE_URL="))
    ?.substring("DATABASE_URL=".length)
    .trim();

const ENVS = [
  { label: "PROD", url: readUrl(".env.local") },
  { label: "STAGE", url: readUrl(".env.audit-staging") },
];

const ELIG = [
  ["user_management", "role", "staff", 1],
  ["system_settings", "role", "staff", 1],
  ["program_management", "role", "participant", 1],
  ["ventures", "role", "investor", 1],
];

for (const env of ENVS) {
  const pool = new pg.Pool({ connectionString: env.url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  console.log(`\n=== ${env.label} ===`);

  for (const [feature, type, ident, val] of ELIG) {
    const r = await pool.query(
      `INSERT INTO feature_eligibility (feature_key, identity_type, identity_value, eligible)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (feature_key, identity_type, identity_value) DO NOTHING`,
      [feature, type, ident, val],
    );
    console.log(`  eligibility ${feature}/${ident}: ${r.rowCount === 1 ? "added" : "already present"}`);
  }

  const ren = await pool.query(
    "UPDATE access_profiles SET name = 'Investor Access' WHERE name = 'Mentor' RETURNING id",
  );
  console.log(`  profile rename Mentor → Investor Access: ${ren.rows.length > 0 ? "renamed (id " + ren.rows[0].id + ")" : "no 'Mentor' profile found"}`);

  if (env.label === "PROD") {
    await pool.query(
      `INSERT INTO permission_audit_log (actor_cid, actor_name, target_cid, target_name, action, details)
       VALUES ('system', 'system', 'system', 'system', 'eligibility_changed',
               'Phase 2: added staff→user_management, staff→system_settings, participant→program_management, investor→ventures (additive; no access granted by eligibility alone)')`,
    );
    await pool.query(
      `INSERT INTO permission_audit_log (actor_cid, actor_name, target_cid, target_name, action, details)
       VALUES ('system', 'system', 'system', 'system', 'profile_updated',
               'Phase 2: renamed access profile "Mentor" → "Investor Access" (role defaults investor/mentor now resolve to the correctly-named profile)')`,
    );
    console.log("  audit entries recorded");
  }

  // Verify final state
  const v1 = await pool.query(
    "SELECT feature_key, identity_value FROM feature_eligibility WHERE identity_type='role' AND (identity_value='staff' AND feature_key IN ('user_management','system_settings') OR identity_value='participant' AND feature_key='program_management' OR identity_value='investor' AND feature_key='ventures') ORDER BY feature_key",
  );
  console.log("  eligibility verify:", JSON.stringify(v1.rows));
  const v2 = await pool.query("SELECT id, name FROM access_profiles WHERE name = 'Investor Access' OR name = 'Mentor'");
  console.log("  profile verify:", JSON.stringify(v2.rows));
  const v3 = await pool.query("SELECT role_name, access_profile_id FROM role_access_profile_defaults WHERE role_name IN ('investor','mentor') ORDER BY role_name");
  console.log("  role defaults verify:", JSON.stringify(v3.rows));

  await pool.end();
}
console.log("\n[done] Phase 2 configuration complete");
