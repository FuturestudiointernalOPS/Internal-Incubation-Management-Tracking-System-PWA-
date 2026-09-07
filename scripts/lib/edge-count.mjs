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
const url = readUrl(".env.local");
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 });
const q = async (label, sql) => {
  try {
    const r = await pool.query(sql);
    console.log(`${label}: ${JSON.stringify(r.rows[0])}`);
  } catch (e) {
    console.log(`${label}: ERROR ${e.message.split("\n")[0]}`);
  }
};
await q("user_groups edges     ", "SELECT COUNT(*)::int AS n FROM user_groups");
await q("contacts w/ group_name", "SELECT COUNT(*)::int AS n FROM contacts WHERE group_name IS NOT NULL AND TRIM(group_name) != '' AND UPPER(group_name) != 'UNASSIGNED'");
await q("distinct group names  ", "SELECT COUNT(DISTINCT group_name)::int AS n FROM user_groups");
await q("FUTURE STUDIO members ", "SELECT COUNT(*)::int AS n FROM user_groups WHERE UPPER(group_name) = 'FUTURE STUDIO'");
await pool.end();
process.exit(0);
