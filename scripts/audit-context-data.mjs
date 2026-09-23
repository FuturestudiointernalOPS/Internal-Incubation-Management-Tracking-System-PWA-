// READ-ONLY: assignment/context data inventory (Phase 8 §2).
// Usage: node scripts/audit-context-data.mjs [envfile]
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
    console.log(`[audit-context] connected via ${envFile}`);
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
    console.log(`\n[audit-context] ${label}:`);
    for (const row of rows) console.log("  " + JSON.stringify(row));
    return rows;
  } catch (error) {
    console.log(`\n[audit-context] ${label}: ERROR (${error.message.split("\n")[0]})`);
    return [];
  }
};

try {
  await runQuery("v2_program_staff — roles", "SELECT role, count(*) AS n FROM v2_program_staff GROUP BY role ORDER BY n DESC");
  await runQuery("v2_program_staff — sample rows", "SELECT program_id, staff_id, role FROM v2_program_staff LIMIT 8");
  await runQuery("contact_roles — context types", "SELECT context_type, role, count(*) AS n FROM contact_roles GROUP BY context_type, role ORDER BY context_type, n DESC");
  await runQuery("participant_programs — total", "SELECT count(*) AS n FROM participant_programs");
  await runQuery("project_members — total", "SELECT count(*) AS n FROM project_members");
  await runQuery("project_members — sample", "SELECT project_id, user_cid FROM project_members LIMIT 5");
  await runQuery("v2_projects — total", "SELECT count(*) AS n FROM v2_projects");
  await runQuery("venture_members — total + roles", "SELECT role, count(*) AS n FROM venture_members GROUP BY role ORDER BY n DESC");
  await runQuery("ventures — total", "SELECT count(*) AS n FROM ventures");
  await runQuery("v2_teams — total", "SELECT count(*) AS n FROM v2_teams");
} finally {
  await pool.end();
}
