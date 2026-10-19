/**
 * APPLY VENTURE IDENTITY — PHASE 0 (Vinance).
 *
 * The Ventures identity has two shapes in the live data: some tables store the
 * internal id (`ventures.id`), others store the decorative code
 * (`ventures.venture_id`, "VNT-…"). This script reads the real map and, on
 * request, unifies every reference onto the internal id.
 *
 * WHY IT IS NOT A PLAIN UPDATE
 *   Several code-holding tables declare `REFERENCES ventures(venture_id)` — a
 *   FOREIGN KEY to the CODE column (see migrations/venture_phase1_foundation.sql,
 *   migrations/venture_schema_align.sql). Writing the internal id there violates
 *   the constraint. Unifying such a column means, in this order:
 *     1. drop the foreign key to `ventures(venture_id)`,
 *     2. rewrite the values (code → internal id),
 *     3. retype the column to match `ventures.id` (uuid on staging, integer on
 *        production) — the FK target and the FK column must share a type,
 *     4. recreate the foreign key against `ventures(id)`.
 *   Columns WITHOUT such a foreign key only need step 2.
 *
 * SAFETY
 *   - DRY RUN by default: connects, reads the map, prints the statements it
 *     would run, writes NOTHING.
 *   - --apply writes inside ONE transaction; any error rolls the whole thing
 *     back, so a half-migrated database is impossible.
 *   - Idempotent: re-running finds nothing left to do.
 *   - The connection string is never printed; errors are redacted.
 *
 * Usage:
 *   node scripts/migrations/apply_venture_identity_phase0.mjs                  -> map only
 *   node scripts/migrations/apply_venture_identity_phase0.mjs --apply          -> unify storage
 *   node scripts/migrations/apply_venture_identity_phase0.mjs --apply --status -> + status normalisation
 *   node scripts/migrations/apply_venture_identity_phase0.mjs --plan-convert-id
 *   ... <.env file>  or  DB_AUDIT_ENV_FILE=<.env file>  (default .env.audit-readonly)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const STATUS = argv.includes("--status");
const PLAN_CONVERT_ID = argv.includes("--plan-convert-id");
const ENV_FILE_ARG = argv.find((arg) => !arg.startsWith("--"));
const ENV_FILE = path.join(
  PROJECT_ROOT,
  process.env.DB_AUDIT_ENV_FILE || ENV_FILE_ARG || ".env.audit-readonly",
);

/** Strip anything that looks like a credential from text before printing it. */
const redact = (value) => String(value).replace(/\/\/[^@\s/]*@/g, "//[redacted]@");

/** Read DATABASE_URL from the env file. The value is never printed. */
function readDatabaseUrl() {
  let contents;
  try {
    contents = readFileSync(ENV_FILE, "utf8");
  } catch (error) {
    if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
    console.error(`Could not read the env file: ${path.basename(ENV_FILE)} (${redact(error.code || error.message)})`);
    return null;
  }
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^DATABASE_URL=(.*)$/);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

/** Types `ALTER COLUMN … TYPE` may retype a reference column to. */
const RETYPABLE = new Set(["uuid", "integer", "bigint", "text"]);

/** Every column that could carry a Venture reference (the code column excluded). */
async function findReferenceColumns(client) {
  const result = await client.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (column_name = 'venture_id' OR column_name LIKE 'venture%\\_id')
      AND table_name <> 'ventures'
    ORDER BY table_name, column_name
  `);
  return result.rows;
}

/**
 * Every foreign key that points AT `ventures`, with the column it starts from
 * and the column it references — `venture_id` (the code) or `id` (the internal).
 */
async function findVentureForeignKeys(client) {
  const result = await client.query(`
    SELECT c.conname,
           c.conrelid::regclass::text AS tbl,
           fa.attname AS col,
           pa.attname AS ref_col,
           pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_attribute fa ON fa.attrelid = c.conrelid AND fa.attnum = ANY (c.conkey)
    JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = ANY (c.confkey)
    WHERE c.contype = 'f' AND c.confrelid = 'public.ventures'::regclass
    ORDER BY 1
  `);
  const byColumn = new Map();
  for (const row of result.rows) {
    const table = String(row.tbl).replace(/^[^.]+\./, "");
    byColumn.set(`${table}.${row.col}`, { ...row, tbl: table });
  }
  return byColumn;
}

/** Per column: how many rows hold the code, the internal id, or neither. */
async function mapColumn(client, { table_name, column_name }) {
  const result = await client.query(`
    SELECT
      COUNT(*) AS rows_total,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM ventures v WHERE v.venture_id = c."${column_name}"::text)) AS as_code,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM ventures v WHERE v.id::text = c."${column_name}"::text)) AS as_internal
    FROM "${table_name}" c
  `);
  const row = result.rows[0];
  return {
    total: Number(row.rows_total),
    asCode: Number(row.as_code),
    asInternal: Number(row.as_internal),
  };
}

/** Rewrite one text column from the code to the internal id. */
function unifyStatement({ table_name, column_name }) {
  return `UPDATE "${table_name}" c SET "${column_name}" = v.id::text
     FROM ventures v
    WHERE c."${column_name}"::text = v.venture_id
      AND v.venture_id IS NOT NULL
      AND c."${column_name}"::text <> v.id::text`;
}

/** The full plan for one column: the statements `--apply` would run. */
function columnPlan(column, fk, idType) {
  const key = `${column.table_name}.${column.column_name}`;
  const isCodeFk = fk && fk.ref_col === "venture_id";
  const statements = [];
  if (isCodeFk) statements.push(`ALTER TABLE "${column.table_name}" DROP CONSTRAINT "${fk.conname}";`);
  statements.push(`${unifyStatement(column)};`);
  if (isCodeFk) {
    if (!RETYPABLE.has(idType)) {
      throw new Error(
        `${key} has a foreign key to ventures(venture_id), but ventures.id is "${idType}" — cannot retype. ` +
          `Handle this column by hand.`,
      );
    }
    statements.push(
      `ALTER TABLE "${column.table_name}" ALTER COLUMN "${column.column_name}" TYPE ${idType} USING "${column.column_name}"::text::${idType};`,
    );
    const def = String(fk.def).replace(
      /REFERENCES\s+(?:"?public"?\.)?"?ventures"?\s*\(\s*venture_id\s*\)/i,
      "REFERENCES ventures(id)",
    );
    statements.push(`ALTER TABLE "${column.table_name}" ADD CONSTRAINT "${fk.conname}" ${def};`);
  }
  return { key, isCodeFk, statements };
}

/** READ-ONLY: what converting `ventures.id` itself would drag along. */
async function planConvertId(client, idType, columns) {
  console.log(`\n--- PLAN: convert ventures.id (${idType}) to UUID`);
  if (idType === "uuid") {
    console.log("  already UUID on this database — nothing to convert.");
    return;
  }
  const columnsToRetype = columns.filter((column) => !["uuid"].includes(column.data_type));
  console.log(`\n  Referencing columns whose TYPE would change (${columnsToRetype.length}):`);
  for (const column of columnsToRetype) {
    console.log(`    - ${column.table_name}.${column.column_name} (${column.data_type})`);
  }
  console.log("\n  Rehearse on staging first, and take a backup.\n");
}

// ── Connect ─────────────────────────────────────────────────────────────────
const dbUrl = readDatabaseUrl();
if (!dbUrl) {
  console.error(
    `\n  Missing DATABASE_URL.\n` +
      `  Looked in the environment and in ${path.basename(ENV_FILE)}.\n` +
      `  Point it with a positional <.env file>, DB_AUDIT_ENV_FILE, or DATABASE_URL.\n` +
      `  (Never run --apply against production without a backup.)\n`,
  );
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
  process.exit(1);
}

const who = await client.query("SELECT current_database() AS db, current_user AS usr");
// A lock is held for the retyping ALTERs; a concurrent app session makes them
// deadlock instead of waiting forever. 15s then a clear failure, never a hang.
await client.query("SET lock_timeout = '15s'");
console.log(`\n=== VENTURE IDENTITY — PHASE 0 ===`);
console.log(`  database: ${who.rows[0].db} · role ${who.rows[0].usr}`);
console.log(`  mode:     ${APPLY ? "APPLY (one transaction)" : "DRY RUN (read-only)"}`);
if (APPLY) {
  console.log(`  NOTE:     stop the app/server first — a live session deadlocks the column retype.`);
}

const venturesPresent = await client.query("SELECT to_regclass('public.ventures') AS t");
if (!venturesPresent.rows[0].t) {
  console.error("\n  No `ventures` table here — nothing to do.\n");
  await client.end();
  process.exit(1);
}

const idColumn = await client.query(`
  SELECT data_type FROM information_schema.columns
  WHERE table_schema='public' AND table_name='ventures' AND column_name='id'`);
const idType = idColumn.rows[0]?.data_type || "unknown";
console.log(`  ventures.id type: ${idType}`);

// ── The map ─────────────────────────────────────────────────────────────────
const columns = await findReferenceColumns(client);
const fkByColumn = await findVentureForeignKeys(client);

console.log(`\n--- MAP: ${columns.length} reference column(s), ${fkByColumn.size} foreign key(s) to ventures\n`);
const pending = [];
for (const column of columns) {
  const key = `${column.table_name}.${column.column_name}`;
  const fk = fkByColumn.get(key);
  const stat = await mapColumn(client, column);
  // A column needs work when it still HOLDS a code, OR when its foreign key
  // points at the code column — an EMPTY table with that foreign key would
  // otherwise keep the old convention forever, and its writers with it.
  if (stat.asCode > 0 || (fk && fk.ref_col === "venture_id")) pending.push({ column, fk });
  if (stat.asCode > 0 || stat.asInternal > 0 || fk) {
    const fkNote = fk ? ` · FK→${fk.ref_col}` : "";
    console.log(
      `  ${key} (${column.data_type}${fkNote}): ` +
        `${stat.asCode} code / ${stat.asInternal} internal / ${stat.total} rows`,
    );
  }
}

console.log(`\n  Foreign keys to ventures by target:`);
for (const fk of fkByColumn.values()) {
  console.log(`    ${fk.tbl}.${fk.col} → ventures.${fk.ref_col} (${fk.conname})`);
}

if (PLAN_CONVERT_ID) {
  await planConvertId(client, idType, columns);
  await client.end();
  process.exit(0);
}

if (pending.length === 0) {
  console.log("\n  Storage already unified: no column still holds a code.");
} else {
  console.log(`\n--- ${pending.length} column(s) still hold the code — the work to do\n`);
  for (const { column, fk } of pending) {
    const plan = columnPlan(column, fk, idType);
    for (const statement of plan.statements) console.log(`  ${statement}`);
  }
}

if (!APPLY) {
  console.log(
    `\n=== DRY RUN COMPLETE — nothing written ===\n` +
      `  To unify the storage:  npm run db:venture-identity -- --apply <.env file>\n` +
      `  Run it on staging first, then production (with a backup).\n`,
  );
  await client.end();
  process.exit(0);
}

// ── APPLY — one transaction, all or nothing ─────────────────────────────────
try {
  await client.query("BEGIN");

  let updated = 0;
  for (const { column, fk } of pending) {
    const plan = columnPlan(column, fk, idType);
    for (const statement of plan.statements) {
      const result = await client.query(statement);
      if (/^UPDATE/i.test(statement)) updated += result.rowCount || 0;
    }
    console.log(`  OK  ${plan.key}${plan.isCodeFk ? " (FK repointed, column retyped)" : ""}`);
  }

  if (STATUS) {
    const statusResult = await client.query(
      "UPDATE ventures SET status = 'prospect' WHERE status = 'pending'",
    );
    console.log(`  OK  ventures.status — ${statusResult.rowCount || 0} legacy 'pending' → 'prospect'`);
  }

  await client.query("COMMIT");
  console.log(`\n=== APPLIED: ${updated} reference row(s) unified${STATUS ? " + status normalised" : ""} ===`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`\n  FAILED — rolled back, nothing changed.\n  ${redact(error.message)}\n`);
  await client.end();
  process.exit(1);
}

// ── Verify: the same map, after ─────────────────────────────────────────────
console.log("\n--- VERIFY (after)\n");
for (const { column } of pending) {
  const stat = await mapColumn(client, column);
  console.log(`  ${column.table_name}.${column.column_name}: ${stat.asCode} code / ${stat.asInternal} internal`);
}
const fksAfter = await findVentureForeignKeys(client);
const stillCode = [...fksAfter.values()].filter((fk) => fk.ref_col === "venture_id");
console.log(`\n  Foreign keys still on ventures.venture_id: ${stillCode.length}`);
for (const fk of stillCode) console.log(`    - ${fk.tbl}.${fk.col} (${fk.conname})`);
console.log("\n  Next: re-run the read-only audit (migrations/audit_venture_identity_map.sql).\n");

await client.end();
