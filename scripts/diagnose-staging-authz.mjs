/**
 * READ-ONLY staging authorization diagnostic.
 * Checks the Super Admin user(s), their grants/restrictions, recent audit
 * events, eligibility state and profile defaults on STAGING only.
 *
 * Usage: node scripts/diagnose-staging-authz.mjs
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
  console.error("No staging connection available");
  process.exit(2);
}
console.log(`[diag] connected via ${used}`);

const q = async (label, sql, args = []) => {
  try {
    const { rows } = await pool.query(sql, args);
    console.log(`\n── ${label} ──`);
    console.log(JSON.stringify(rows, null, 1));
    return rows;
  } catch (e) {
    console.log(`\n── ${label} ── ERROR: ${e.message.split("\n")[0]}`);
    return [];
  }
};

await q("super admin contacts", "SELECT cid, name, email, role, status, access_profile_id, group_name FROM contacts WHERE role = 'super_admin'");
const sas = await q("all distinct roles in contacts", "SELECT role, count(*) AS n FROM contacts GROUP BY role ORDER BY n DESC");

// Grants/restrictions for every super admin
const saCids = (await pool.query("SELECT cid FROM contacts WHERE role = 'super_admin'")).rows.map((r) => r.cid);
if (saCids.length) {
  const ph = saCids.map((_, i) => `$${i + 1}`).join(",");
  await q("user_capabilities (grants) for SA users", `SELECT user_cid, module, capability, access_level, granted_by, expires_at FROM user_capabilities WHERE user_cid IN (${ph})`, saCids);
  await q("user_capability_restrictions for SA users", `SELECT user_cid, module, capability, restricted_by, expires_at FROM user_capability_restrictions WHERE user_cid IN (${ph})`, saCids);
  await q("group_memberships for SA users", `SELECT user_cid, group_name, status, started_at, expires_at FROM group_memberships WHERE user_cid IN (${ph})`, saCids);
  await q("user_groups for SA users", `SELECT user_cid, group_name FROM user_groups WHERE user_cid IN (${ph})`, saCids);
}

await q("latest 25 audit events", `SELECT actor_cid, actor_name, target_cid, target_name, action, module, capability, details, created_at FROM permission_audit_log ORDER BY created_at DESC LIMIT 25`);
await q("restricted events ever (SA-related)", `SELECT actor_name, target_cid, target_name, module, capability, details, created_at FROM permission_audit_log WHERE action IN ('restricted','unrestricted') ORDER BY created_at DESC LIMIT 20`);
await q("granted/revoked events (last 20)", `SELECT actor_name, target_cid, target_name, module, capability, details, created_at FROM permission_audit_log WHERE action IN ('granted','revoked') ORDER BY created_at DESC LIMIT 20`);

await q("feature_eligibility for user_management", "SELECT feature_key, identity_type, identity_value, eligible FROM feature_eligibility WHERE feature_key = 'user_management'");
await q("ALL feature_eligibility rows", "SELECT feature_key, identity_type, identity_value, eligible FROM feature_eligibility ORDER BY identity_value, feature_key");
await q("access_profile_capabilities (profile 1)", "SELECT profile_id, module, capability, access_level FROM access_profile_capabilities ORDER BY module, capability");
await q("ALL contacts", "SELECT cid, name, email, role, status, access_profile_id, group_name FROM contacts ORDER BY role");
await q("user_capabilities ALL users", "SELECT user_cid, module, capability, access_level, granted_by, expires_at FROM user_capabilities");
await q("user_capability_restrictions ALL users", "SELECT user_cid, module, capability, restricted_by, expires_at FROM user_capability_restrictions");
await q("access_profiles", "SELECT id, name, is_active FROM access_profiles ORDER BY name");
await q("role_access_profile_defaults", "SELECT role_name, access_profile_id FROM role_access_profile_defaults ORDER BY role_name");

await pool.end();
console.log("\n[done] read-only, nothing modified");
process.exit(0);
