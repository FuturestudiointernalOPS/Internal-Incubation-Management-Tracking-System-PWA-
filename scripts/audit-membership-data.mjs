// READ-ONLY membership data audit (Phase 5 §17).
// Never modifies anything. Prefers .env.local (production).
// Usage: node scripts/audit-membership-data.mjs [envfile]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const file = process.argv[2] || ".env.local";

const readDatabaseUrl = (file) => {
  try {
    for (const line of readFileSync(resolve(process.cwd(), file), "utf-8").split("\n")) {
      if (line.startsWith("DATABASE_URL=")) return line.substring("DATABASE_URL=".length).trim();
    }
  } catch {}
  return null;
};

let pool = null;
for (const envFile of [file, ".env.local", ".env.prod-verify", ".env.audit-staging"]) {
  const databaseUrl = readDatabaseUrl(envFile);
  if (!databaseUrl) continue;
  try {
    const candidatePool = new pg.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 });
    await candidatePool.query("SELECT 1");
    console.log(`[audit-membership] connected via ${envFile}`);
    pool = candidatePool;
    break;
  } catch {}
}
if (!pool) {
  console.error("No working connection");
  process.exit(2);
}

const runQuery = async (label, sql) => {
  try {
    const { rows } = await pool.query(sql);
    console.log(`\n[audit-membership] ${label}:`);
    for (const row of rows) console.log("  " + JSON.stringify(row));
    return rows;
  } catch (error) {
    console.log(`\n[audit-membership] ${label}: ERROR (${error.message.split("\n")[0]})`);
    return [];
  }
};

try {
  await runQuery("contacts (total)", "SELECT count(*) AS total FROM contacts");
  await runQuery(
    "groups metadata",
    "SELECT name, is_protected, is_active FROM groups ORDER BY name",
  );
  await runQuery(
    "memberships by group + status",
    `SELECT group_name, status, count(*) AS n
     FROM group_memberships
     GROUP BY group_name, status ORDER BY group_name, status`,
  );
  await runQuery(
    "FUTURE STUDIO members",
    "SELECT count(*) AS n FROM group_memberships WHERE group_name = 'FUTURE STUDIO'",
  );
  await runQuery(
    "ACTIVE memberships (status active AND not past expiry)",
    `SELECT count(*) AS n FROM group_memberships
     WHERE status = 'active' AND (expires_at IS NULL OR expires_at > NOW())`,
  );
  await runQuery(
    "EFFECTIVELY EXPIRED memberships (status expired OR past expiry)",
    `SELECT count(*) AS n FROM group_memberships
     WHERE status = 'expired' OR (status = 'active' AND expires_at IS NOT NULL AND expires_at <= NOW())`,
  );
  await runQuery(
    "DUPLICATE memberships (same person+group, >1 row)",
    `SELECT user_cid, group_name, count(*) AS n
     FROM group_memberships GROUP BY user_cid, group_name HAVING count(*) > 1`,
  );
  await runQuery(
    "contacts with group_name but NO membership record",
    `SELECT count(*) AS n FROM contacts c
     WHERE c.group_name IS NOT NULL AND c.group_name != ''
       AND NOT EXISTS (
         SELECT 1 FROM group_memberships gm
         WHERE gm.user_cid = c.cid AND UPPER(TRIM(gm.group_name)) = UPPER(TRIM(c.group_name))
       )`,
  );
  await runQuery(
    "memberships WITHOUT a matching contact",
    `SELECT gm.user_cid, gm.group_name, gm.status
     FROM group_memberships gm
     LEFT JOIN contacts c ON c.cid = gm.user_cid
     WHERE c.cid IS NULL`,
  );
  await runQuery(
    "membership events by action",
    "SELECT action, count(*) AS n FROM group_membership_events GROUP BY action ORDER BY action",
  );
  await runQuery(
    "user_groups edges (legacy mirror)",
    "SELECT group_name, count(*) AS n FROM user_groups GROUP BY group_name ORDER BY group_name",
  );
} finally {
  await pool.end();
}
