/**
 * LEGACY IDENTITY MIGRATION — one transaction, rehearsal by default.
 *
 * Usage:
 *   node scripts/db-audit/apply-legacy-identity-migration.mjs                  -> DRY RUN (begin, run, ROLLBACK)
 *   node scripts/db-audit/apply-legacy-identity-migration.mjs --apply          -> COMMIT if every check passes
 *   node scripts/db-audit/apply-legacy-identity-migration.mjs --apply .env.local
 *
 * The dry run EXECUTES the statements and then rolls them back, so the plan and
 * the post-conditions are real while the database is left untouched. It is the
 * rehearsal: the same code path, one instruction away from the commit.
 *
 * The run is refused (ROLLBACK, exit 1) when:
 *   - a statement fails;
 *   - any post-condition reports `ok = false`.
 *
 * The connection string is never printed; error text is redacted first.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const SQL_FILE = path.join(PROJECT_ROOT, "migrations", "legacy_identity_migration.sql");

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const ENV_FILE_ARG = argv.find((arg) => !arg.startsWith("--"));
const ENV_FILE = path.join(
  PROJECT_ROOT,
  process.env.DB_AUDIT_ENV_FILE || ENV_FILE_ARG || ".env.audit-readonly",
);

const redact = (value) => String(value).replace(/\/\/[^@\s/]*@/g, "//[redacted]@");

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const text = readFileSync(ENV_FILE, "utf8");
  const line = text.split(/\r?\n/).find((entry) => entry.startsWith("DATABASE_URL="));
  if (!line) throw new Error(`DATABASE_URL introuvable dans ${ENV_FILE}`);
  return line.slice("DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
}

/**
 * Split on ';' at statement level, aware of dollar-quoted blocks ($$ … $$).
 * The migration ends with a DO block whose body contains semicolons; a naive
 * split would cut it in half. Comment lines are removed first.
 */
function parseStatements(sql) {
  const text = sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  const statements = [];
  let current = "";
  let inDollarQuote = false;

  for (let index = 0; index < text.length; index += 1) {
    if (text.startsWith("$$", index)) {
      inDollarQuote = !inDollarQuote;
      current += "$$";
      index += 1;
      continue;
    }
    const char = text[index];
    if (char === ";" && !inDollarQuote) {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

const statements = parseStatements(readFileSync(SQL_FILE, "utf8"));
const databaseUrl = readDatabaseUrl();
const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

function printResult(statement, result) {
  const firstLine = statement.split("\n").find((line) => line.trim()) || "";
  const label = firstLine.replace(/\s+/g, " ").slice(0, 90);
  if (result.rows?.length) {
    console.log(`\n--- ${label}`);
    console.table(result.rows);
  } else {
    console.log(`\n--- ${label} · ${result.rowCount ?? 0} ligne(s)`);
  }
}

let failed = false;

try {
  await client.connect();
  const target = await client.query("SELECT current_database() AS db, current_user AS usr");
  console.log(
    `Cible : base ${target.rows[0].db} · utilisateur ${target.rows[0].usr} · mode ${
      APPLY ? "ÉCRITURE" : "SIMULATION (rollback)"
    }`,
  );

  await client.query("BEGIN");

  for (const statement of statements) {
    const result = await client.query(statement);
    printResult(statement, result);

    const checks = (result.rows || []).filter((row) => row && "ok" in row);
    for (const check of checks) {
      if (check.ok !== true) {
        failed = true;
        console.error(
          `\n[ÉCHEC] ${check.check_name}: ${check.failing} ligne(s) non conformes.`,
        );
      }
    }
  }

  if (failed) {
    await client.query("ROLLBACK");
    console.error("\nTransaction ANNULÉE — les contrôles n'ont pas passé.");
    process.exitCode = 1;
  } else if (APPLY) {
    await client.query("COMMIT");
    console.log("\nTransaction VALIDÉE (COMMIT).");
  } else {
    await client.query("ROLLBACK");
    console.log(
      "\nSimulation terminée — ROLLBACK effectué, aucune donnée modifiée. Relancer avec --apply pour valider.",
    );
  }
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // The connection may already be gone.
  }
  console.error("\n[ERREUR]", redact(error.message));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
