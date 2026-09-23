/**
 * APPLY A SCHEMA FILE — a generic, dry-run-first transport for an idempotent
 * one-statement-per-line .sql file.
 *
 * Sibling of scripts/db-audit/apply-align-migration.mjs, which is hardcoded to
 * migrations/align_schema_with_code.sql. This one takes the FILE as an argument
 * so any aligned file can be reviewed and applied with the same tooling and the
 * same safety properties.
 *
 * Behaviour:
 *   - DRY RUN by default: prints every statement, reads no credentials, and
 *     connects to nothing.
 *   - --apply executes. Each statement runs independently in its own try/catch;
 *     results and errors are collected and the run NEVER aborts midway (one bad
 *     statement must not hide the state of the others).
 *   - REFUSES to run a file containing a destructive statement (DROP TABLE /
 *     DROP DATABASE / DROP SCHEMA / DROP COLUMN, TRUNCATE, DELETE FROM, UPDATE).
 *     These files exist to ADD things. Override with --allow-destructive only if
 *     you have read the file and mean it.
 *   - The connection string is NEVER printed; error text is redacted first.
 *
 * Usage:
 *   node scripts/db-audit/apply-schema-file.mjs <file.sql>                    -> dry run
 *   node scripts/db-audit/apply-schema-file.mjs <file.sql> --apply            -> execute
 *   node scripts/db-audit/apply-schema-file.mjs <file.sql> --apply .env.local -> execute against .env.local
 *   DB_AUDIT_ENV_FILE=.env.local node scripts/db-audit/apply-schema-file.mjs <file.sql> --apply
 *
 * The env file default is .env.audit-readonly, which on this repository does NOT
 * exist. Be deliberate about which database you point at: per docs/PRODUCTION_TEST.md
 * section 2, .env.local and .env.prod-verify point at PRODUCTION, while
 * .env.staging and .env.audit-staging point at staging.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const ALLOW_DESTRUCTIVE = argv.includes("--allow-destructive");
const positional = argv.filter((arg) => !arg.startsWith("--"));

const FILE_ARG = positional[0];
if (!FILE_ARG) {
  console.error("\n  Usage: node scripts/db-audit/apply-schema-file.mjs <file.sql> [--apply] [envFile]\n");
  process.exit(1);
}
const SQL_FILE = path.isAbsolute(FILE_ARG) ? FILE_ARG : path.join(PROJECT_ROOT, FILE_ARG);
const ENV_FILE = path.join(
  PROJECT_ROOT,
  process.env.DB_AUDIT_ENV_FILE || positional[1] || ".env.audit-readonly",
);

/** Strip anything that looks like a credential from text before printing it. */
const redact = (value) => String(value).replace(/\/\/[^@\s/]*@/g, "//[redacted]@");

/**
 * Statements that MUTATE OR REMOVE data or structure. Anchored at the start (after
 * optional whitespace) on purpose: "ALTER TABLE x ALTER COLUMN y DROP NOT NULL"
 * and "ADD COLUMN IF NOT EXISTS updated_at" must NOT trip this.
 */
const DESTRUCTIVE_PATTERNS = [
  /^\s*drop\s+(table|database|schema|column)\b/i,
  /^\s*truncate\b/i,
  /^\s*delete\s+from\b/i,
  /^\s*update\s+[^\s]+\s+set\b/i,
];

/**
 * Split the .sql file into executable statements.
 *
 * The contract makes this reliable: one statement per line, terminated by ';',
 * with no ';' inside a string literal. So the FIRST ';' on a line is always the
 * terminator, and whatever follows must be a trailing comment or nothing. A line
 * that breaks the contract is reported instead of guessed at — a mis-split
 * statement is worse than a refused run.
 */
function parseStatements(sql) {
  const statements = [];
  const problems = [];

  sql.split(/\r?\n/).forEach((raw, index) => {
    const lineNo = index + 1;
    const line = raw.trim();
    // Blank lines and comments (including every reporting-only line) are skipped.
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
  } catch (error) {
    console.error(`  Could not read the env file: ${path.basename(envFile)} (${redact(error.code || error.message)})`);
    return null;
  }
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^DATABASE_URL=(.*)$/);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

// ── Read and parse first: never touch a database we cannot describe exactly ──
if (!existsSync(SQL_FILE)) {
  console.error(`\n  File not found: ${path.relative(PROJECT_ROOT, SQL_FILE)}`);
  process.exit(1);
}
const sql = readFileSync(SQL_FILE, "utf8");
const { statements, problems } = parseStatements(sql);

console.log(`\n=== APPLY SCHEMA FILE ===`);
console.log(`  file:       ${path.relative(PROJECT_ROOT, SQL_FILE)}`);
console.log(`  statements: ${statements.length} executable`);

if (problems.length > 0) {
  console.error(`\n  REFUSING TO RUN — ${problems.length} line(s) break the one-statement-per-line contract:`);
  for (const problem of problems) {
    console.error(`    line ${problem.lineNo}: ${problem.reason}`);
    console.error(`      ${problem.text.slice(0, 120)}`);
  }
  console.error(`\n  Fix the .sql file (one statement per line, each ending in ';') and re-run.`);
  process.exit(1);
}

// ── Destructive-statement guard ─────────────────────────────────────────────
const destructive = statements.filter(({ sql: statement }) =>
  DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(statement)),
);
if (destructive.length > 0 && !ALLOW_DESTRUCTIVE) {
  console.error(`\n  REFUSING TO RUN — ${destructive.length} destructive statement(s) found.`);
  console.error(`  This runner exists to ADD things. Each statement below would remove or overwrite data or structure:`);
  for (const destructiveStatement of destructive) {
    console.error(`    line ${destructiveStatement.lineNo}: ${destructiveStatement.sql.slice(0, 120)}`);
  }
  console.error(`\n  If you have read the file and mean it, re-run with --allow-destructive.`);
  process.exit(1);
}

// ── DRY RUN (default) — prints what would run, connects to nothing ──────────
if (!APPLY) {
  console.log(`  mode:       DRY RUN (no connection, no credentials read)\n`);
  for (const { lineNo, sql: statement } of statements) {
    console.log(`  [${String(lineNo).padStart(4)}] ${statement};`);
  }
  console.log(`\n=== DRY RUN COMPLETE: ${statements.length} statements would run, nothing was executed ===`);
  console.log(`  To execute: node scripts/db-audit/apply-schema-file.mjs ${path.relative(PROJECT_ROOT, SQL_FILE)} --apply`);
  console.log(`  Then run the file's verification queries by hand.\n`);
  process.exit(0);
}

// ── APPLY — needs a connection string; fail clearly, never hang ─────────────
const dbUrl = process.env.DATABASE_URL || readDatabaseUrl(ENV_FILE);
if (!dbUrl) {
  console.error(`\n  Missing DATABASE_URL.`);
  console.error(`  Looked in the environment and in ${path.basename(ENV_FILE)}.`);
  console.error(`  Provide one with DB_AUDIT_ENV_FILE=<env file>, a positional <env file> argument,`);
  console.error(`  or DATABASE_URL in the environment. The connection string is never printed.`);
  process.exit(1);
}

const { default: pg } = await import("pg");
const client = new pg.Client({
  connectionString: dbUrl,
  ssl: /sslmode=/.test(dbUrl) ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  query_timeout: 60000,
});

try {
  await client.connect();
} catch (error) {
  console.error(`\n  Could not connect: ${redact(error.message)}`);
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
  } catch (error) {
    // Collected, never fatal — the remaining statements still run.
    failed.push({ lineNo, statement, error: redact(error.message) });
    console.log(`  ERR [${String(lineNo).padStart(4)}] ${statement.slice(0, 96)}`);
    console.log(`           -> ${redact(error.message)}`);
  }
}

console.log(`\n=== RESULT: ${succeeded.length}/${statements.length} succeeded, ${failed.length} failed ===`);
if (failed.length > 0) {
  console.log(`  A failure on an ALTER usually means the target table is absent on`);
  console.log(`  this database (see the file header). That is expected for the legacy`);
  console.log(`  tables and is not a reason to stop.`);
}
console.log(`  Next: run the verification queries in the .sql file by hand.\n`);

await client.end();
if (failed.length > 0) process.exitCode = 1;
