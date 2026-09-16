/**
 * ALIGN THE SCHEMA WITH THE CODE — runs migrations/align_schema_with_code.sql
 *
 * That .sql file is the single source of truth for the drift between the live
 * database and the columns the application reads and writes. This runner only
 * transports it.
 *
 * Behavior mirrors scripts/db-audit/apply-migrations.mjs:
 *   - one statement per line in the .sql file, each terminated by ';'
 *   - each statement runs independently in its own try/catch, results and errors
 *     are collected, and the run NEVER aborts midway (one bad statement must not
 *     hide the state of the others)
 *   - connection string comes from the same env file as the other db-audit
 *     scripts (.env.audit-readonly), overridable by DB_AUDIT_ENV_FILE,
 *     by a positional path argument, or by DATABASE_URL in the environment
 *   - the connection string is NEVER printed; error text is redacted first
 *
 * SAFETY: this is a DRY RUN unless --apply is passed. The dry run does not read
 * credentials and does not connect to anything — it prints exactly what would run.
 *
 * Usage:
 *   node scripts/db-audit/apply-align-migration.mjs                 -> dry run
 *   node scripts/db-audit/apply-align-migration.mjs --apply         -> execute
 *   node scripts/db-audit/apply-align-migration.mjs --apply .env.staging
 *   DB_AUDIT_ENV_FILE=.env.staging node scripts/db-audit/apply-align-migration.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const SQL_FILE = path.join(PROJECT_ROOT, "migrations", "align_schema_with_code.sql");

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
// Optional: positional env-file path, else DB_AUDIT_ENV_FILE, else the db-audit default.
const ENV_FILE_ARG = argv.find((a) => !a.startsWith("--"));
const ENV_FILE = path.join(
  PROJECT_ROOT,
  process.env.DB_AUDIT_ENV_FILE || ENV_FILE_ARG || ".env.audit-readonly",
);

/** Strip anything that looks like a credential from text before printing it. */
const redact = (value) => String(value).replace(/\/\/[^@\s/]*@/g, "//[redacted]@");

/**
 * Split the .sql file into executable statements.
 *
 * The file's contract makes this reliable: one statement per line, terminated by
 * ';', with no ';' inside a string literal. So the FIRST ';' on a line is always
 * the terminator, and whatever follows it must be a trailing comment or nothing.
 * Any line that breaks the contract is reported as a problem instead of being
 * guessed at — a mis-split statement is worse than a refused run.
 */
function parseStatements(sql) {
  const statements = [];
  const problems = [];

  sql.split(/\r?\n/).forEach((raw, index) => {
    const lineNo = index + 1;
    const line = raw.trim();
    // Blank lines and comments (including every line of sections 6, 7 and 8,
    // which are reporting-only) are skipped and never executed.
    if (!line || line.startsWith("--")) return;

    const terminator = line.indexOf(";");
    if (terminator === -1) {
      problems.push({ lineNo, reason: "no ';' terminator", text: line });
      return;
    }
    const statement = line.slice(0, terminator).trim();
    const trailing = line.slice(terminator + 1).trim();
    if (trailing && !trailing.startsWith("--")) {
      problems.push({ lineNo, reason: `unexpected text after ';': ${trailing.slice(0, 40)}`, text: line });
      return;
    }
    if (!statement) {
      problems.push({ lineNo, reason: "empty statement", text: line });
      return;
    }
    statements.push({ lineNo, sql: statement });
  });

  return { statements, problems };
}

/** Read DATABASE_URL from the env file. The value is never printed. */
function readDatabaseUrl(envFile) {
  let contents;
  try {
    contents = readFileSync(envFile, "utf8");
  } catch (e) {
    console.error(`Could not read the env file: ${path.basename(envFile)} (${redact(e.code || e.message)})`);
    return null;
  }
  for (const line of contents.split(/\r?\n/)) {
    const m = line.match(/^DATABASE_URL=(.*)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

// ── Parse first: never touch a database we cannot describe exactly ──────────
let sql;
try {
  sql = readFileSync(SQL_FILE, "utf8");
} catch (e) {
  console.error(`Could not read ${path.relative(PROJECT_ROOT, SQL_FILE)}: ${redact(e.message)}`);
  process.exit(1);
}

const { statements, problems } = parseStatements(sql);

console.log(`\n=== ALIGN SCHEMA WITH CODE ===`);
console.log(`  file:       ${path.relative(PROJECT_ROOT, SQL_FILE)}`);
console.log(`  statements: ${statements.length} executable`);

if (problems.length > 0) {
  console.error(`\n  REFUSING TO RUN — ${problems.length} line(s) break the one-statement-per-line contract:`);
  for (const p of problems) {
    console.error(`    line ${p.lineNo}: ${p.reason}`);
    console.error(`      ${p.text.slice(0, 120)}`);
  }
  console.error(`\n  Fix the .sql file (one statement per line, each ending in ';') and re-run.`);
  process.exit(1);
}

// ── DRY RUN (default) — prints what would run, connects to nothing ──────────
if (!APPLY) {
  console.log(`  mode:       DRY RUN (no connection, no credentials read)\n`);
  for (const { lineNo, sql: statement } of statements) {
    console.log(`  [${String(lineNo).padStart(4)}] ${statement};`);
  }
  console.log(`\n=== DRY RUN COMPLETE: ${statements.length} statements would run, nothing was executed ===`);
  console.log(`  To execute: node scripts/db-audit/apply-align-migration.mjs --apply`);
  console.log(`  Then run the verification queries in section 8 of the .sql file by hand.\n`);
  process.exit(0);
}

// ── APPLY — needs a connection string; fail clearly, never hang ─────────────
const dbUrl = process.env.DATABASE_URL || readDatabaseUrl(ENV_FILE);
if (!dbUrl) {
  console.error(`\n  Missing DATABASE_URL.`);
  console.error(`  Looked in the environment and in ${path.basename(ENV_FILE)} (not created yet by default).`);
  console.error(`  Provide one with DB_AUDIT_ENV_FILE=<env file>, a positional <env file> argument,`);
  console.error(`  or DATABASE_URL in the environment. The connection string is never printed.`);
  process.exit(1);
}

const { default: pg } = await import("pg");
const client = new pg.Client({
  connectionString: dbUrl,
  ssl: /sslmode=/.test(dbUrl) ? undefined : { rejectUnauthorized: false },
  // Bounded: a wrong host must fail, not sit there.
  connectionTimeoutMillis: 15000,
  query_timeout: 60000,
});

try {
  await client.connect();
} catch (e) {
  console.error(`\n  Could not connect: ${redact(e.message)}`);
  console.error(`  Check the DATABASE_URL in ${path.basename(ENV_FILE)} (value not printed).`);
  process.exit(1);
}

try {
  // Database name and role only — never the URL, host or credentials.
  const who = await client.query("SELECT current_database() AS db, current_user AS usr");
  console.log(`\n  connected:  database ${who.rows[0].db}, role ${who.rows[0].usr}`);
} catch (_) {
  console.log(`\n  connected:  (could not read the database name)`);
}

console.log(`  mode:       APPLY — running ${statements.length} idempotent statements\n`);

const succeeded = [];
const failed = [];
for (const { lineNo, sql: statement } of statements) {
  try {
    await client.query(statement);
    succeeded.push(statement);
    console.log(`  OK  [${String(lineNo).padStart(4)}] ${statement.slice(0, 96)}`);
  } catch (e) {
    // Collected, never fatal — the remaining statements still run.
    failed.push({ lineNo, statement, error: redact(e.message) });
    console.log(`  ERR [${String(lineNo).padStart(4)}] ${statement.slice(0, 96)}`);
    console.log(`           -> ${redact(e.message)}`);
  }
}

console.log(`\n=== RESULT: ${succeeded.length}/${statements.length} succeeded, ${failed.length} failed ===`);
if (failed.length > 0) {
  console.log(`  Failures are usually the unique index (duplicate rows) or a constraint`);
  console.log(`  already violated by existing data. Inspect with the section 8 queries.`);
}
console.log(`  Next: run the section 8 verification queries in the .sql file by hand.\n`);

await client.end();
if (failed.length > 0) process.exitCode = 1;
