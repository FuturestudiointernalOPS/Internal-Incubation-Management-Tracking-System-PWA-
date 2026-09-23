// READ-ONLY — count the membership edges the bootstrap migration will create.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const readUrl = (file) => {
  try {
    for (const line of readFileSync(resolve(process.cwd(), file), "utf-8").split("\n")) {
      if (line.startsWith("DATABASE_URL=")) return line.substring("DATABASE_URL=".length).trim();
    }
  } catch {}
  return null;
};
const databaseUrl = readUrl(".env.local");
const pool = new pg.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 });
const queryAndLog = async (label, sql) => {
  try {
    const queryResult = await pool.query(sql);
    console.log(`${label}: ${JSON.stringify(queryResult.rows[0])}`);
  } catch (error) {
    console.log(`${label}: ERROR ${error.message.split("\n")[0]}`);
  }
};
await queryAndLog("user_groups edges     ", "SELECT COUNT(*)::int AS n FROM user_groups");
await queryAndLog("contacts w/ group_name", "SELECT COUNT(*)::int AS n FROM contacts WHERE group_name IS NOT NULL AND TRIM(group_name) != '' AND UPPER(group_name) != 'UNASSIGNED'");
await queryAndLog("distinct group names  ", "SELECT COUNT(DISTINCT group_name)::int AS n FROM user_groups");
await queryAndLog("FUTURE STUDIO members ", "SELECT COUNT(*)::int AS n FROM user_groups WHERE UPPER(group_name) = 'FUTURE STUDIO'");
await pool.end();
process.exit(0);
