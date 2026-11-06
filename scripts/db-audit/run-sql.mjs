/**
 * Apply additive SQL against a staging env file only.
 *
 * Usage: node scripts/db-audit/run-sql.mjs <sql-file> [.env.local]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sqlPath = process.argv[2];
const envName = process.argv[3] || ".env.local";
if (!sqlPath) {
  console.error("Usage: node scripts/db-audit/run-sql.mjs <sql-file> [.env.local]");
  process.exit(1);
}
if (![".env.local", ".env.staging"].includes(envName)) {
  console.error("Refusing non-staging env file. Use .env.local or .env.staging.");
  process.exit(1);
}

let databaseUrl = null;
for (const line of readFileSync(path.join(root, envName), "utf8").split(/\r?\n/)) {
  const match = line.match(/^DATABASE_URL=(.*)$/);
  if (match) {
    databaseUrl = match[1].trim().replace(/^["']|["']$/g, "");
    break;
  }
}
if (!databaseUrl) {
  console.error("Missing DATABASE_URL in", envName);
  process.exit(1);
}

const database = new URL(databaseUrl);
const stagingProjectRef = "mbpaxrfhqqclzyiefuab";
if (
  !database.hostname.includes(stagingProjectRef) &&
  !database.username.endsWith(`.${stagingProjectRef}`)
) {
  console.error("Refusing database URL that does not identify the staging project.");
  process.exit(1);
}

const sql = readFileSync(path.resolve(sqlPath), "utf8");
const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log("Connected staging project:", stagingProjectRef, "env:", envName);
try {
  await client.query(sql);
  console.log("OK applied", sqlPath);
} finally {
  await client.end();
}
