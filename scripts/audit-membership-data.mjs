// READ-ONLY membership data audit (Phase 5 §17).
// Never modifies anything. Prefers .env.local (production).
// Usage: node scripts/audit-membership-data.mjs [envfile]
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
    console.log(`[audit-membership] connected via ${f}`);
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
    console.log(`\n[audit-membership] ${label}:`);
    for (const r of rows) console.log("  " + JSON.stringify(r));
    return rows;
  } catch (e) {
    console.log(`\n[audit-membership] ${label}: ERROR (${e.message.split("\n")[0]})`);
    return [];
  }
};

try {
  await q("contacts (total)", "SELECT count(*) AS total FROM contacts");
  await q(
    "groups metadata",
    "SELECT name, is_protected, is_active FROM groups ORDER BY name",
  );
  await q(
    "memberships by group + status",
    `SELECT group_name, status, count(*) AS n
     FROM group_memberships
     GROUP BY group_name, status ORDER BY group_name, status`,
  );
  await q(
    "FUTURE STUDIO members",
    "SELECT count(*) AS n FROM group_memberships WHERE group_name = 'FUTURE STUDIO'",
  );
  await q(
    "ACTIVE memberships (status active AND not past expiry)",
    `SELECT count(*) AS n FROM group_memberships
     WHERE status = 'active' AND (expires_at IS NULL OR expires_at > NOW())`,
  );
  await q(
    "EFFECTIVELY EXPIRED memberships (status expired OR past expiry)",
    `SELECT count(*) AS n FROM group_memberships
     WHERE status = 'expired' OR (status = 'active' AND expires_at IS NOT NULL AND expires_at <= NOW())`,
  );
  await q(
    "DUPLICATE memberships (same person+group, >1 row)",
    `SELECT user_cid, group_name, count(*) AS n
     FROM group_memberships GROUP BY user_cid, group_name HAVING count(*) > 1`,
  );
  await q(
    "contacts with group_name but NO membership record",
    `SELECT count(*) AS n FROM contacts c
     WHERE c.group_name IS NOT NULL AND c.group_name != ''
       AND NOT EXISTS (
         SELECT 1 FROM group_memberships gm
         WHERE gm.user_cid = c.cid AND UPPER(TRIM(gm.group_name)) = UPPER(TRIM(c.group_name))
       )`,
  );
  await q(
    "memberships WITHOUT a matching contact",
    `SELECT gm.user_cid, gm.group_name, gm.status
     FROM group_memberships gm
     LEFT JOIN contacts c ON c.cid = gm.user_cid
     WHERE c.cid IS NULL`,
  );
  await q(
    "membership events by action",
    "SELECT action, count(*) AS n FROM group_membership_events GROUP BY action ORDER BY action",
  );
  await q(
    "user_groups edges (legacy mirror)",
    "SELECT group_name, count(*) AS n FROM user_groups GROUP BY group_name ORDER BY group_name",
  );
} finally {
  await pool.end();
}
