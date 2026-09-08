/**
 * RUN-ONLY READ-ONLY AUDIT QUERIES AGAINST THE PRODUCTION DATABASE.
 *
 * Usage:
 *   node scripts/db-audit/run-readonly.mjs <sql-file>
 *
 * Reads DATABASE_URL from <project-root>/.env.audit-readonly
 * (a gitignored file you create — never commit it).
 *
 * SAFETY:
 *   - This script ONLY executes statements that start with
 *     SELECT / WITH / SET / SHOW / EXPLAIN / VALUES.
 *   - Anything else (INSERT/UPDATE/DELETE/ALTER/CREATE/DROP/GRANT/...)
 *     is SKIPPED and reported, never executed.
 *   - statement_timeout is forced to 60s per session.
 *   - The connection string is NEVER printed — only host + user are shown
 *     so you can confirm the target database.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
// Optional: node run-readonly.mjs <sql-file> <env-file> (default .env.audit-readonly)
const ENV_FILE = path.join(PROJECT_ROOT, process.argv[3] || ".env.audit-readonly");

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error("Usage: node scripts/db-audit/run-readonly.mjs <sql-file>");
  process.exit(1);
}

// ── Load DATABASE_URL from the gitignored env file ─────────────────────────
let dbUrl = null;
try {
  const env = readFileSync(ENV_FILE, "utf8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^DATABASE_URL=(.*)$/);
    if (m) {
      dbUrl = m[1].trim().replace(/^["']|["']$/g, "");
      break;
    }
  }
} catch {
  // fall through to error below
}
if (!dbUrl) {
  console.error(
    "Missing DATABASE_URL.\n" +
      "Create the file  .env.audit-readonly  at the project root with one line:\n" +
      "  DATABASE_URL=postgresql://user:password@host:port/database\n" +
      "(the file is gitignored; delete it after the audit).",
  );
  process.exit(1);
}

// ── Read-only statement allowlist ──────────────────────────────────────────
const ALLOWED_PREFIX = /^\s*(select|with|set\s|show\s|explain\b(?!\s+analyze)|values\b)/i;

// ── Split SQL file into statements (each ends with ';' at end of line) ─────
// Full-line comments are stripped first so the allowlist sees the real
// statement start (the audit files only use full-line `--` comments).
const raw = readFileSync(path.resolve(PROJECT_ROOT, sqlFile), "utf8");
const cleaned = raw
  .split(/\r?\n/)
  .filter((l) => !/^\s*--/.test(l))
  .join("\n");
const statements = cleaned
  .split(/;\s*(?:\r?\n|$)/)
  .map((s) => s.trim())
  .filter(Boolean);

// ── Connect ────────────────────────────────────────────────────────────────
const client = new pg.Client({
  connectionString: dbUrl,
  ssl: /sslmode=/.test(dbUrl) ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
await client.connect();
await client.query("SET statement_timeout = '60s'");

const host = (() => {
  try {
    return new URL(dbUrl).host;
  } catch {
    return "?";
  }
})();
const who = await client.query("SELECT current_database() AS db, current_user AS usr");
console.log(`\n=== CONNECTED: ${who.rows[0].db} @ ${host} as ${who.rows[0].usr} ===\n`);

// ── Execute ────────────────────────────────────────────────────────────────
let ran = 0;
let skipped = 0;
for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  if (!ALLOWED_PREFIX.test(stmt)) {
    skipped++;
    console.log(
      `--- [${i + 1}] SKIPPED (not read-only): ${stmt.slice(0, 80)}...`,
    );
    continue;
  }
  try {
    const res = await client.query(stmt);
    ran++;
    console.log(`\n--- [${i + 1}] ${res.command} · ${res.rowCount ?? 0} rows`);
    const rows = res.rows || [];
    const max = 300;
    for (const row of rows.slice(0, max)) {
      console.log(JSON.stringify(row));
    }
    if (rows.length > max) console.log(`... (${rows.length - max} more rows)`);
  } catch (err) {
    console.error(`\n--- [${i + 1}] ERROR: ${err.message}`);
    console.error(`    statement: ${stmt.slice(0, 160)}...`);
  }
}

console.log(
  `\n=== DONE: ${ran} statements executed, ${skipped} skipped (read-only guard) ===`,
);
await client.end();
