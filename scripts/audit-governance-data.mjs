// READ-ONLY governance data audit (Phase 7 §21). Never modifies anything.
// Usage: node scripts/audit-governance-data.mjs [envfile]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const file = process.argv[2] || ".env.local";
const readUrl = (f) => {
  try {
    for (const line of readFileSync(resolve(process.cwd(), f), "utf-8").split("\n")) {
      if (line.startsWith("DATABASE_URL=")) return line.substring("DATABASE_URL=".length).trim();
    }
  } catch {}
  return null;
};

let pool = null;
for (const f of [file, ".env.local", ".env.prod-verify", ".env.audit-staging"]) {
  const url = readUrl(f);
  if (!url) continue;
  try {
    const p = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 });
    await p.query("SELECT 1");
    console.log(`[audit-governance] connected via ${f}`);
    pool = p;
    break;
  } catch {}
}
if (!pool) {
  console.error("No working connection");
  process.exit(2);
}

const q = async (label, sql) => {
  try {
    const { rows } = await pool.query(sql);
    console.log(`\n[audit-governance] ${label}:`);
    for (const r of rows) console.log("  " + JSON.stringify(r));
    return rows;
  } catch (e) {
    console.log(`\n[audit-governance] ${label}: ERROR (${e.message.split("\n")[0]})`);
    return [];
  }
};

try {
  await q("permission_audit_log — total", "SELECT count(*) AS n FROM permission_audit_log");
  await q(
    "permission_audit_log — by action (recent 90 days)",
    `SELECT action, count(*) AS n FROM permission_audit_log
     WHERE created_at > NOW() - INTERVAL '90 days'
     GROUP BY action ORDER BY n DESC`,
  );
  await q(
    "permission_audit_log — most recent 5",
    `SELECT id, actor_name, target_name, action, module, capability, previous_value, new_value, created_at
     FROM permission_audit_log ORDER BY created_at DESC LIMIT 5`,
  );
  await q("access profiles", "SELECT id, name, is_active FROM access_profiles ORDER BY id");
  await q(
    "role defaults",
    `SELECT rpd.role_name, ap.name AS profile FROM role_access_profile_defaults rpd
     JOIN access_profiles ap ON ap.id = rpd.access_profile_id ORDER BY rpd.role_name`,
  );
  await q("feature_eligibility rows", "SELECT count(*) AS n FROM feature_eligibility");
  await q("individual grants", "SELECT count(*) AS n FROM user_capabilities WHERE expires_at IS NULL OR expires_at > NOW()");
  await q("restrictions", "SELECT count(*) AS n FROM user_capability_restrictions WHERE expires_at IS NULL OR expires_at > NOW()");
  await q("protected groups", "SELECT name, is_protected FROM groups WHERE is_protected = 1");
  await q(
    "ANOMALY: contacts with invalid access_profile_id",
    `SELECT c.cid, c.name, c.access_profile_id FROM contacts c
     LEFT JOIN access_profiles ap ON ap.id = c.access_profile_id
     WHERE c.access_profile_id IS NOT NULL AND ap.id IS NULL`,
  );
  await q(
    "ANOMALY: memberships without a contact",
    `SELECT gm.user_cid, gm.group_name FROM group_memberships gm
     LEFT JOIN contacts c ON c.cid = gm.user_cid WHERE c.cid IS NULL`,
  );
  await q(
    "ANOMALY: duplicate memberships",
    `SELECT user_cid, group_name, count(*) AS n FROM group_memberships
     GROUP BY user_cid, group_name HAVING count(*) > 1`,
  );
  await q(
    "ANOMALY: membership rows with impossible status",
    "SELECT user_cid, group_name, status FROM group_memberships WHERE status NOT IN ('active','expired','ended')",
  );
  await q(
    "ANOMALY: role defaults referencing inactive profiles",
    `SELECT rpd.role_name, ap.name FROM role_access_profile_defaults rpd
     JOIN access_profiles ap ON ap.id = rpd.access_profile_id WHERE ap.is_active = 0`,
  );
} finally {
  await pool.end();
}
