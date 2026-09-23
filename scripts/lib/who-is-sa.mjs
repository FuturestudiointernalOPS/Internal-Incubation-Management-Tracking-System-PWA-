// READ-ONLY probe — identify the super admin(s) + distinguishing facts per env
// connection. Prints names/emails/cids/counts only — never passwords.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const readDatabaseUrl = (file) => {
  try {
    for (const line of readFileSync(resolve(process.cwd(), file), "utf-8").split("\n")) {
      if (line.startsWith("DATABASE_URL=")) {
        return line.substring("DATABASE_URL=".length).trim();
      }
    }
  } catch {}
  return null;
};

const probe = async (label, file) => {
  const databaseUrl = readDatabaseUrl(file);
  if (!databaseUrl) {
    console.log(`${label} (${file}): no DATABASE_URL`);
    return;
  }
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 12000,
  });
  try {
    await pool.query("SELECT 1");
  } catch (error) {
    console.log(`${label} (${file}): CONNECT FAILED -> ${error.message}`);
    return;
  }
  const queryRows = async (sql) => {
    try {
      return (await pool.query(sql)).rows;
    } catch (error) {
      return [{ error: error.message.split("\n")[0] }];
    }
  };
  console.log(`\n=== ${label} (${file}) — CONNECTED ===`);
  const admins = await queryRows("SELECT cid, name, email, status FROM contacts WHERE role = 'super_admin' AND deleted_at IS NULL ORDER BY created_at");
  console.log(`super_admin count: ${admins.length}`);
  for (const admin of admins) console.log(`  ${admin.cid} | ${admin.name || "(no name)"} | ${admin.email || "(no email)"} | status=${admin.status}`);
  const users = await queryRows("SELECT COUNT(*)::int AS n FROM contacts WHERE deleted_at IS NULL");
  const staff = await queryRows("SELECT COUNT(*)::int AS n FROM contacts WHERE role = 'staff' AND deleted_at IS NULL");
  const profiles = await queryRows("SELECT COUNT(*)::int AS n FROM access_profiles");
  const eligibility = await queryRows("SELECT COUNT(*)::int AS n FROM feature_eligibility");
  console.log(`active users: ${users[0].n} | staff: ${staff[0].n} | access_profiles: ${profiles[0].n} | eligibility rows: ${eligibility[0].n}`);
  await pool.end();
};

await probe("ENV A", ".env.local");
await probe("ENV B", ".env.audit-staging");
process.exit(0);
