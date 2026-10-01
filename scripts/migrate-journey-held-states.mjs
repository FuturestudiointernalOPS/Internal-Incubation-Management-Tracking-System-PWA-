/**
 * MIGRATE — the Venture held-state split (`locked` → `upcoming` / `blocked`).
 *
 * `locked` used to carry two meanings at once: a Journey that had not started,
 * and a milestone an explicit dependency was holding back. They are now two
 * states. This runs the migration's OWN SQL — one source of truth, the file in
 * src/migrations — so the script and the record-of-change can never drift.
 *
 * SAFE BY CONSTRUCTION
 *   - DRY RUN by default: it runs the statements inside a transaction that is
 *     then ROLLED BACK. It reports exactly how many rows each statement would
 *     touch and writes nothing at all.
 *   - The connection comes from DATABASE_URL, or from the env file you name on
 *     the command line. It NEVER falls back to .env.local — that file points at
 *     PRODUCTION, and a silent fallback is how a "dry run" becomes a deploy.
 *   - The connection string is never printed; only the env file's NAME is.
 *   - Idempotent: after an apply, a second run reports zero rows to change.
 *
 * Usage:
 *   node scripts/migrate-journey-held-states.mjs .env.staging           # dry run
 *   node scripts/migrate-journey-held-states.mjs .env.staging --apply   # write
 *   DATABASE_URL=postgres://… node scripts/migrate-journey-held-states.mjs          # dry run
 */

const APPLY = process.argv.includes("--apply");
const ENV_FILE = process.argv.slice(2).find((argument) => !argument.startsWith("--"));

if (!process.env.DATABASE_URL && ENV_FILE) {
  try {
    process.loadEnvFile(ENV_FILE);
  } catch (_) {
    // Absent file — the guard below reports it.
  }
}

if (!process.env.DATABASE_URL) {
  console.error(
    [
      "",
      "DATABASE_URL is not set.",
      "Pass an env file BY NAME (never relying on .env.local, which is PRODUCTION):",
      "  node scripts/migrate-journey-held-states.mjs .env.staging",
      `${APPLY ? "  node scripts/migrate-journey-held-states.mjs .env.staging --apply" : ""}`,
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const fs = await import("node:fs");
const path = await import("node:path");
const { fileURLToPath } = await import("node:url");

const here = path.dirname(fileURLToPath(import.meta.url));
const SQL_PATH = path.join(here, "..", "src", "migrations", "20260929_venture_journey_upcoming.sql");

/** The migration file, minus its comments, as individual statements. */
function readStatements() {
  const raw = fs.readFileSync(SQL_PATH, "utf8");
  return raw
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** A short, human label for one statement (what it does, not how it is written). */
function labelOf(statement) {
  const target = statement.match(/SET status = '([a-z_]+)'/i);
  if (statement.toUpperCase().startsWith("ALTER")) return "journey stages: default state aligned";
  if (target) return `rows whose state becomes '${target[1]}'`;
  return "statement";
}

const ROLLBACK = Symbol("dry-run-rollback");
const statements = readStatements();

const { initDb } = await import("../src/lib/db.js");
const db = await initDb();

console.log("\n=== MIGRATE — VENTURE HELD STATES (locked → upcoming / blocked) ===");
console.log(`  env:  ${ENV_FILE ? ENV_FILE : "(DATABASE_URL from the environment)"}`);
console.log(`  mode: ${APPLY ? "APPLY (writes)" : "DRY RUN (writes nothing — the transaction is rolled back)"}`);
console.log(`  file: ${path.relative(path.join(here, ".."), SQL_PATH)}\n`);

/**
 * Run every statement inside ONE transaction. The counts are collected OUTSIDE
 * the callback so they survive the deliberate rollback of a dry run.
 */
const counts = [];
async function runAsTransaction() {
  await db.transaction(async (query) => {
    for (const statement of statements) {
      const result = await query(statement);
      counts.push({ label: labelOf(statement), affected: result.rowsAffected ?? result.rows?.length ?? 0 });
    }
    if (!APPLY) throw ROLLBACK;
  });
}

try {
  await runAsTransaction();
} catch (error) {
  if (error !== ROLLBACK) {
    console.error(`\nThe run could not reach or change the database: ${error?.code || error?.message || error}\n`);
    process.exit(1);
  }
}

const total = counts.reduce((sum, entry) => sum + entry.affected, 0);
for (const entry of counts) {
  console.log(`  ${String(entry.affected).padStart(6)}  ${entry.label}`);
}
console.log(`\n  ${APPLY ? "rows written:   " : "rows that would change: "} ${total}\n`);

if (!APPLY) {
  console.log("Nothing was written. Re-run with --apply to write these rows.\n");
} else {
  console.log(total === 0 ? "Nothing was left to migrate.\n" : "Done. Re-run without --apply to confirm nothing is left to change.\n");
}

process.exit(0);
