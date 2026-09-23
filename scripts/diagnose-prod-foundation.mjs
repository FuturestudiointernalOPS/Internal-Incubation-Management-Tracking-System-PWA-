// READ-ONLY diagnostic v2: post-boot-chain state of the foundation.
// Never prints credentials.
// Usage: node scripts/diagnose-prod-foundation.mjs [envfile]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const file = process.argv[2] || ".env.local";

function readDatabaseUrl(file) {
  for (const line of readFileSync(resolve(process.cwd(), file), "utf-8").split("\n")) {
    if (line.startsWith("DATABASE_URL=")) {
      return line.substring("DATABASE_URL=".length).trim();
    }
  }
  return null;
}

const databaseUrl = readDatabaseUrl(file);
if (!databaseUrl) {
  console.log(`no DATABASE_URL in ${file}`);
  process.exit(1);
}

const userMatch = databaseUrl.match(/\/\/([^:@]+)@/);
const userPart = userMatch ? userMatch[1] : "";
const projectRef = userPart.startsWith("postgres.") ? userPart.substring("postgres.".length) : userPart;

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 12000,
});

const runQuery = async (label, sql) => {
  try {
    const { rows } = await pool.query(sql);
    console.log(`[diag] ${label}:`);
    for (const row of rows) console.log("       " + JSON.stringify(row));
  } catch (error) {
    console.log(`[diag] ${label}: ERROR (${error.message})`);
  }
};

try {
  console.log(`\n[diag] ${file} → project ref: ${projectRef || "(unparsed)"}`);

  await runQuery(
    "counts",
    "SELECT (SELECT count(*) FROM contacts) AS contacts, (SELECT count(*) FROM user_groups) AS user_groups, (SELECT count(*) FROM access_profiles) AS profiles, (SELECT count(*) FROM role_capabilities) AS role_caps"
  );
  await runQuery("foundation tables", "SELECT table_name FROM information_schema.tables WHERE table_name IN ('groups','group_memberships','group_membership_events','authz_migrations') ORDER BY table_name");
  await runQuery("authz_migrations", "SELECT name FROM authz_migrations ORDER BY name");
  await runQuery("groups rows", "SELECT name, is_protected, is_active FROM groups ORDER BY name");
  await runQuery("group_memberships count", "SELECT count(*) AS n, count(DISTINCT group_id) AS groups FROM group_memberships");
  await runQuery("group_membership_events count", "SELECT count(*) AS n, count(DISTINCT action) AS actions FROM group_membership_events");
  await runQuery("user_groups rows", "SELECT group_name, count(*) AS n FROM user_groups GROUP BY group_name ORDER BY group_name");
  await runQuery("feature_eligibility columns", "SELECT column_name FROM information_schema.columns WHERE table_name = 'feature_eligibility' ORDER BY ordinal_position");
  await runQuery("feature_eligibility total", "SELECT count(*) AS n FROM feature_eligibility");
  await runQuery(
    "stale rows (old names)",
    "SELECT count(*) AS n FROM feature_eligibility WHERE subject_id IN ('admin','participant','founder')"
  );
  await runQuery(
    "staff eligibility",
    "SELECT feature_key, eligible FROM feature_eligibility WHERE identity_type = 'role' AND identity_value = 'staff' ORDER BY feature_key"
  );
} catch (error) {
  console.log(`[diag] ERROR: ${error.message}`);
} finally {
  await pool.end();
}
