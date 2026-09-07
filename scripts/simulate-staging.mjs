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
  const url = readFileSync(resolve(projectRoot, file), "utf-8")
    .split("\n")
    .find((l) => l.startsWith("DATABASE_URL="))
    ?.substring("DATABASE_URL=".length)
    .trim();
  if (!url) continue;
  try {
    const probe = await import("pg");
    const pool = new probe.default.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
    await pool.query("SELECT 1");
    await pool.end();
    process.env.DATABASE_URL = url;
    console.log(`[simulate] connected via ${file}`);
    break;
  } catch {}
}

const { initDb } = await import("../src/lib/db.js");
const { getAuthorizationContext } = await import("../src/lib/authorization/index.js");
const { getSession } = await import("../src/lib/auth.js");

const db = await initDb();
const q = async (sql) => (await db.execute({ sql, args: [] })).rows;

const contacts = await q("SELECT cid, name, email, role, status FROM contacts ORDER BY role");
console.log(`\nResolving authorization context for EVERY staging user with the real resolver...\n`);
let failures = 0;
for (const c of contacts) {
  try {
    const ctx = await getAuthorizationContext({ cid: c.cid, role: c.role });
    const eff = Object.keys(ctx.effective || {}).length;
    console.log(`OK   ${c.role.padEnd(14)} ${String(c.cid).padEnd(18)} ${(c.name || "(no name)").padEnd(14)} effective modules: ${eff}  profile: ${ctx.profile?.profileName || "none"}  isSA: ${ctx.isSuperAdmin}`);
  } catch (e) {
    failures++;
    console.log(`FAIL ${c.role.padEnd(14)} ${String(c.cid).padEnd(18)} → ${e.message.split("\n")[0]}`);
  }
}
console.log(`\n${failures} context resolution failure(s)`);
process.exit(0);
