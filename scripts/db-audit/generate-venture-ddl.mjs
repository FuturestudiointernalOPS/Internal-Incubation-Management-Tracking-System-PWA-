/**
 * VENTURE TABLE DDL — copy table DEFINITIONS (schema only) from a source
 * database to a target, for tables that exist on the source and not the
 * target.
 *
 * Usage:
 *   node scripts/db-audit/generate-venture-ddl.mjs \
 *     --from .env.audit-staging --to .env.local \
 *     --out scripts/db-audit/tmp-missing-venture-tables.sql \
 *     [--exclude name1,name2]
 *
 * What it does:
 *   - lists every public table named venture% on the source;
 *   - keeps those absent on the target (minus --exclude, which are reported);
 *   - introspects columns, defaults, constraints and indexes (READ-ONLY on
 *     both databases) and writes ONE STATEMENT PER LINE — the contract
 *     apply-schema-file.mjs enforces;
 *   - foreign keys pointing at tables that exist neither on the target nor
 *     in the batch are REPORTED and skipped rather than emitted to fail.
 *
 * It never applies anything: review the file, dry-run it, then apply it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const argv = process.argv.slice(2);
const argValue = (flag) => {
  const index = argv.indexOf(flag);
  return index === -1 ? null : argv[index + 1] || null;
};

const FROM_ENV = argValue("--from");
const TO_ENV = argValue("--to");
const OUT_FILE = argValue("--out");
const EXCLUDE = new Set(
  (argValue("--exclude") || "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean),
);

if (!FROM_ENV || !TO_ENV || !OUT_FILE) {
  console.error(
    "Usage: node scripts/db-audit/generate-venture-ddl.mjs --from <env> --to <env> --out <file.sql> [--exclude a,b]",
  );
  process.exit(1);
}

function readDatabaseUrl(envFile) {
  const contents = readFileSync(path.join(PROJECT_ROOT, envFile), "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^DATABASE_URL=(.*)$/);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error(`No DATABASE_URL found in ${envFile}`);
}

async function connect(envFile) {
  const url = readDatabaseUrl(envFile);
  const client = new pg.Client({
    connectionString: url,
    ssl: /sslmode=/.test(url) ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  return client;
}

const listVentureTables = async (client) =>
  (
    await client.query(
      `SELECT relname FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'venture%'
       ORDER BY relname`,
    )
  ).rows.map((row) => row.relname);

/** Every public table — the target for a foreign key is not always venture%. */
const listAllTables = async (client) =>
  (
    await client.query(
      `SELECT relname FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
       ORDER BY relname`,
    )
  ).rows.map((row) => row.relname);

const COLUMNS_SQL = `SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type,
       a.attnotnull AS not_null, a.attidentity AS identity,
       pg_get_expr(ad.adbin, ad.adrelid) AS default_expr
FROM pg_attribute a
LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY a.attnum`;

const CONSTRAINTS_SQL = `SELECT conname AS name, contype AS kind, pg_get_constraintdef(oid) AS def
FROM pg_constraint WHERE conrelid = $1::regclass
ORDER BY CASE contype WHEN 'p' THEN 0 WHEN 'u' THEN 1 WHEN 'c' THEN 2 WHEN 'f' THEN 3 ELSE 4 END, conname`;

const INDEXES_SQL = `SELECT indexname AS name, indexdef AS def
FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1
ORDER BY indexname`;

const source = await connect(FROM_ENV);
const target = await connect(TO_ENV);

const sourceTables = await listVentureTables(source);
const targetTables = new Set(await listVentureTables(target));
const targetAllTables = new Set(await listAllTables(target));
const targetCount = targetTables.size;

const missing = sourceTables.filter((name) => !targetTables.has(name));
const toCreate = missing.filter((name) => !EXCLUDE.has(name));
const deferred = missing.filter((name) => EXCLUDE.has(name));

console.log(`source venture tables: ${sourceTables.length}`);
console.log(`target venture tables: ${targetCount}`);
console.log(`missing on target:     ${missing.length}`);
for (const name of missing) console.log(`  ${EXCLUDE.has(name) ? "DEFERRED " : "TO CREATE"}  ${name}`);

if (toCreate.length === 0) {
  console.log("\nNothing to create.");
  await source.end();
  await target.end();
  process.exit(0);
}

const creates = [];
const sequences = new Set();
const foreignKeys = [];
const indexes = [];
const warnings = [];
const batchTables = new Set(toCreate);

for (const table of toCreate) {
  const columns = (await source.query(COLUMNS_SQL, [table])).rows;
  const constraints = (await source.query(CONSTRAINTS_SQL, [table])).rows;
  const indexRows = (await source.query(INDEXES_SQL, [table])).rows;
  const constraintNames = new Set(constraints.map((constraint) => constraint.name));

  const columnDefs = columns.map((column) => {
    let def = `"${column.name}" ${column.type}`;
    if (column.not_null) def += " NOT NULL";
    if (column.identity === "a") def += " GENERATED ALWAYS AS IDENTITY";
    else if (column.identity === "d") def += " GENERATED BY DEFAULT AS IDENTITY";
    else if (column.default_expr) {
      const sequenceMatch = /nextval\('([^']+)'::regclass\)/.exec(column.default_expr);
      if (sequenceMatch) sequences.add(sequenceMatch[1].replace(/^public\./, ""));
      def += ` DEFAULT ${column.default_expr}`;
    }
    return def;
  });

  for (const constraint of constraints.filter(
    (candidate) => candidate.kind === "p" || candidate.kind === "u" || candidate.kind === "c",
  )) {
    columnDefs.push(`CONSTRAINT "${constraint.name}" ${constraint.def}`);
  }
  creates.push(`CREATE TABLE IF NOT EXISTS public."${table}" (${columnDefs.join(", ")});`);

  for (const fk of constraints.filter((candidate) => candidate.kind === "f")) {
    const reference = /REFERENCES\s+([A-Za-z0-9_]+)/.exec(fk.def);
    const referencedTable = reference ? reference[1] : null;
    if (referencedTable && !targetAllTables.has(referencedTable) && !batchTables.has(referencedTable)) {
      warnings.push(
        `${table}: FK "${fk.name}" skipped — references "${referencedTable}", which exists on neither database in scope`,
      );
      continue;
    }
    foreignKeys.push(`ALTER TABLE public."${table}" ADD CONSTRAINT "${fk.name}" ${fk.def};`);
  }

  for (const index of indexRows) {
    if (constraintNames.has(index.name) || index.name.endsWith("_pkey")) continue;
    const withIfNotExists = index.def.replace(
      /^CREATE (UNIQUE )?INDEX /,
      (_match, unique) => `CREATE ${unique || ""}INDEX IF NOT EXISTS `,
    );
    indexes.push(`${withIfNotExists};`);
  }
}

const lines = [];
lines.push("-- ============================================================");
lines.push(`-- Venture tables missing on the target, definitions copied from ${FROM_ENV}`);
lines.push(`-- Generated ${new Date().toISOString()} — SCHEMA ONLY, no data.`);
lines.push(`-- Tables: ${toCreate.join(", ")}`);
if (deferred.length > 0) lines.push(`-- Deferred by request: ${deferred.join(", ")}`);
lines.push("-- ============================================================");
lines.push("");
if (sequences.size > 0) {
  lines.push("-- sequences used by column defaults");
  for (const sequence of [...sequences].sort()) lines.push(`CREATE SEQUENCE IF NOT EXISTS public."${sequence}";`);
  lines.push("");
}
lines.push("-- tables");
for (const statement of creates) lines.push(statement);
lines.push("");
if (foreignKeys.length > 0) {
  lines.push("-- foreign keys (emitted after every table exists)");
  for (const statement of foreignKeys) lines.push(statement);
  lines.push("");
}
if (indexes.length > 0) {
  lines.push("-- indexes");
  for (const statement of indexes) lines.push(statement);
  lines.push("");
}
for (const warning of warnings) lines.push(`-- SKIPPED: ${warning}`);

writeFileSync(path.join(PROJECT_ROOT, OUT_FILE), `${lines.join("\n")}\n`, "utf8");

console.log(
  `\nwrote ${OUT_FILE}: ${creates.length} tables, ${foreignKeys.length} foreign keys, ${indexes.length} indexes, ${sequences.size} sequences`,
);
if (warnings.length > 0) {
  console.log("skipped:");
  for (const warning of warnings) console.log(`  ${warning}`);
}

await source.end();
await target.end();
