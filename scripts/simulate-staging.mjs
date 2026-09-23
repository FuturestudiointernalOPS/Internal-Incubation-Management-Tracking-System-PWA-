/**
 * STAGING resolver simulation — binds the REAL authorization resolver
 * against STAGING data to reproduce the 500/403s the Super Admin sees.
 * Read-only. Forces the staging env file (never production).
 *
 * Usage: node scripts/simulate-staging.mjs
 */
import { register } from "node:module";
await register(new URL("./lib/import-loader.mjs", import.meta.url));

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

for (const file of [".env.staging", ".env.audit-staging"]) {
  const databaseUrl = readFileSync(resolve(projectRoot, file), "utf-8")
    .split("\n")
    .find((envLine) => envLine.startsWith("DATABASE_URL="))
    ?.substring("DATABASE_URL=".length)
    .trim();
  if (!databaseUrl) continue;
  try {
    const pgModule = await import("pg");
    const pool = new pgModule.default.Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
    await pool.query("SELECT 1");
    await pool.end();
    process.env.DATABASE_URL = databaseUrl;
    console.log(`[simulate] connected via ${file}`);
    break;
  } catch {}
}

const { initDb } = await import("../src/lib/db.js");
const { getAuthorizationContext } = await import("../src/lib/authorization/index.js");
await import("../src/lib/auth.js");

const db = await initDb();
const runQuery = async (sql) => (await db.execute({ sql, args: [] })).rows;

const contacts = await runQuery("SELECT cid, name, email, role, status FROM contacts ORDER BY role");
console.log(`\nResolving authorization context for EVERY staging user with the real resolver...\n`);
let failures = 0;
for (const contact of contacts) {
  try {
    const ctx = await getAuthorizationContext({ cid: contact.cid, role: contact.role });
    const effectiveCount = Object.keys(ctx.effective || {}).length;
    console.log(`OK   ${contact.role.padEnd(14)} ${String(contact.cid).padEnd(18)} ${(contact.name || "(no name)").padEnd(14)} effective modules: ${effectiveCount}  profile: ${ctx.profile?.profileName || "none"}  isSA: ${ctx.isSuperAdmin}`);
  } catch (error) {
    failures++;
    console.log(`FAIL ${contact.role.padEnd(14)} ${String(contact.cid).padEnd(18)} → ${error.message.split("\n")[0]}`);
  }
}
console.log(`\n${failures} context resolution failure(s)`);
process.exit(0);
