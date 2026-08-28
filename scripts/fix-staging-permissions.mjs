/**
 * STAGING-ONLY permission repair (idempotent).
 *
 * 1. Populates the empty "Staff" access profile with the 11 approved default
 *    capabilities (messaging.view/send, reports.create, tasks.*, knowledge.*)
 *    so role defaults + profile overrides actually deliver access.
 * 2. Restores the seeded eligibility rows (operations, ventures for staff and
 *    program_manager) that were unset during testing — the direct cause of
 *    the 403 "not eligible" grant rejections.
 * 3. Removes the inert `finance.view` grant on the facilitator (resolves DENY
 *    — facilitator has no finance eligibility; the row is misleading).
 *
 * Never touches production. Usage: node scripts/fix-staging-permissions.mjs
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const files = [".env.staging", ".env.audit-staging"];
let pool = null;
let used = null;
for (const f of files) {
  try {
    const url = readFileSync(f, "utf-8")
      .split("\n")
      .find((l) => l.startsWith("DATABASE_URL="))
      ?.substring("DATABASE_URL=".length)
      .trim();
    if (!url) continue;
    const p = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
    await p.query("SELECT 1");
    pool = p;
    used = f;
    break;
  } catch {}
}
if (!pool) {
  console.error("No staging connection available — aborting (production untouched)");
  process.exit(2);
}
console.log(`[fix] connected via ${used} — STAGING ONLY`);

const APPROVED_DEFAULTS = [
  ["messaging", "view", 1],
  ["messaging", "send", 2],
  ["reports", "create", 2],
  ["tasks", "view", 1],
  ["tasks", "create", 2],
  ["tasks", "edit", 3],
  ["tasks", "delete", 4],
  ["knowledge", "view", 1],
  ["knowledge", "create", 2],
  ["knowledge", "edit", 3],
  ["knowledge", "delete", 4],
];

// 1. Staff profile capabilities
const prof = await pool.query("SELECT id, name FROM access_profiles WHERE name = 'Staff'");
if (prof.rows.length === 0) {
  console.log("[fix] 'Staff' profile not found — nothing to populate");
} else {
  const pid = prof.rows[0].id;
  for (const [module, capability, level] of APPROVED_DEFAULTS) {
    await pool.query(
      `INSERT INTO access_profile_capabilities (profile_id, module, capability, access_level)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (profile_id, module, capability) DO UPDATE SET access_level = EXCLUDED.access_level`,
      [pid, module, capability, level],
    );
  }
  const { rows } = await pool.query(
    "SELECT count(*) AS n FROM access_profile_capabilities WHERE profile_id = $1",
    [pid],
  );
  console.log(`[fix] 'Staff' profile now has ${rows[0].n} capability rows`);
}

// 2. Restore seeded eligibility rows
const RESTORE_ELIG = [
  ["operations", "staff"],
  ["operations", "program_manager"],
  ["ventures", "staff"],
  ["ventures", "program_manager"],
];
for (const [feature, role] of RESTORE_ELIG) {
  await pool.query(
    `INSERT INTO feature_eligibility (feature_key, identity_type, identity_value, eligible)
     VALUES ($1, 'role', $2, 1)
     ON CONFLICT (feature_key, identity_type, identity_value) DO UPDATE SET eligible = 1`,
    [feature, role],
  );
}
console.log(`[fix] restored ${RESTORE_ELIG.length} eligibility rows (operations/ventures for staff/program_manager)`);

// 3. Remove the inert facilitator finance grant
const del = await pool.query(
  `DELETE FROM user_capabilities
   WHERE module = 'finance' AND capability = 'view'
     AND user_cid IN (SELECT cid FROM contacts WHERE role = 'facilitator')`,
);
console.log(`[fix] removed ${del.rowCount} inert facilitator finance grant(s)`);

const audit = await pool.query(
  `INSERT INTO permission_audit_log (actor_cid, actor_name, target_cid, target_name, action, details)
   VALUES ('system', 'system', 'system', 'staging-repair', 'staging_repaired',
           'Populated Staff profile defaults; restored operations/ventures eligibility; removed inert facilitator finance grant')
   RETURNING id`,
);
console.log(`[fix] audit entry ${audit.rows[0].id} recorded`);

await pool.end();
console.log("[fix] done — staging repaired");
process.exit(0);
