/**
 * MERGE THE DUPLICATE "Interns 2026" GROUPS — one transaction, simulation first.
 *
 *   node scripts/db-audit/merge-duplicate-interns-groups.mjs            # simulation: reports, rolls back
 *   node scripts/db-audit/merge-duplicate-interns-groups.mjs --apply    # commits
 *   DB_AUDIT_ENV_FILE=.env.local node scripts/db-audit/merge-duplicate-interns-groups.mjs --apply
 *
 * Why these six rows exist: group creation had no duplicate guard, so the same
 * name was inserted six times on 2026-10-09 and each insert auto-created a
 * registration form. The groups are empty (no contact carries the name), and
 * only one of the six forms is live: it owns the "Interns 2026 Run" with its one
 * submission. That live row is kept; the others are removed.
 *
 * The canonical row is chosen from the DATA, not hardcoded: the row whose form
 * has a run wins, then the oldest. The surviving group inherits the programme
 * of the oldest duplicate that had one (here: "Internship"), so it still shows
 * under the right programme.
 *
 * What the script does, each step guarded and reported:
 *   - keeps one `families` row for the name;
 *   - attaches it to the duplicate's programme when it has none;
 *   - renames any contact / user-group / run assignment that still uses the
 *     name or an id of a row being removed;
 *   - deletes the auto-created registration forms of the removed rows ONLY when
 *     they are provably unused (no run, no version, no response, no campaign…);
 *   - deletes the duplicate `families` rows;
 *   - verifies exactly one row is left, then commits (or rolls back).
 *
 * The connection string is never printed: only the database name, the role and
 * the Supabase project ref.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

const APPLY = process.argv.includes("--apply");
const ALLOW_PRODUCTION = process.argv.includes("--allow-production");
const GROUP_NAME = "Interns 2026";
const PRODUCTION_REF = "yakxdxdzuojafzdkqhjd";

const ENV_FILE = path.join(
  PROJECT_ROOT,
  process.env.DB_AUDIT_ENV_FILE || ".env.local",
);

const redact = (value) => String(value).replace(/\/\/[^@\s/]*@/g, "//[redacted]@");

function readDatabaseUrl(file) {
  if (!existsSync(file)) return null;
  const contents = readFileSync(file, "utf8");
  const line = contents.split(/\r?\n/).find((entry) => entry.startsWith("DATABASE_URL="));
  return line ? line.substring("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "") : null;
}

function projectRef(url) {
  const match = decodeURIComponent(url).match(/postgres\.([a-z0-9]+)/i);
  return match ? match[1] : "unknown";
}

const url = process.env.DATABASE_URL || readDatabaseUrl(ENV_FILE);
if (!url) {
  console.error(`\n  Missing DATABASE_URL (looked in the environment and ${path.basename(ENV_FILE)}).\n`);
  process.exit(1);
}

const ref = projectRef(url);
if (ref === PRODUCTION_REF && !ALLOW_PRODUCTION) {
  console.error(
    `\n  REFUSING: this connection is PRODUCTION (${ref}).` +
      `\n  Re-run with --allow-production only after a backup and a read review.\n`,
  );
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: /sslmode=/.test(url) ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
  query_timeout: 60000,
});

await client.connect();
const who = await client.query("SELECT current_database() AS db, current_user AS usr");
console.log(`\n=== MERGE "${GROUP_NAME}" ===`);
console.log(`  database: ${who.rows[0].db}`);
console.log(`  role:     ${who.rows[0].usr}`);
console.log(`  project:  ${ref}`);
console.log(`  mode:     ${APPLY ? "APPLY (commits)" : "SIMULATION (rolls back)"}\n`);

/** Row-count guard: an unexpected count aborts the transaction. */
function expect(label, result, predicate) {
  const ok = typeof predicate === "function" ? predicate(result) : result.rowCount === predicate;
  if (!ok) {
    throw new Error(`${label}: row count ${result.rowCount} did not match the expectation — rolling back`);
  }
  console.log(`  ok  ${label}: ${result.rowCount} row(s)`);
  return result;
}

/** A form is safe to delete only when nothing else uses it. */
async function formReferences(formId) {
  const references = [];
  const checks = [
    ["platform_form_runs", "SELECT COUNT(*)::int AS n FROM platform_form_runs WHERE form_id::text = $1"],
    ["platform_form_versions", "SELECT COUNT(*)::int AS n FROM platform_form_versions WHERE form_id::text = $1"],
    ["campaigns", "SELECT COUNT(*)::int AS n FROM campaigns WHERE form_id::text = $1"],
    ["form_responses", "SELECT COUNT(*)::int AS n FROM form_responses WHERE form_id::text = $1"],
    ["platform_evaluation_frameworks", "SELECT COUNT(*)::int AS n FROM platform_evaluation_frameworks WHERE form_id::text = $1"],
    ["platform_import_batches", "SELECT COUNT(*)::int AS n FROM platform_import_batches WHERE form_id::text = $1"],
    ["platform_import_review_flags", "SELECT COUNT(*)::int AS n FROM platform_import_review_flags WHERE form_id::text = $1"],
    ["venture_origins", "SELECT COUNT(*)::int AS n FROM venture_origins WHERE form_id::text = $1"],
    ["families", "SELECT COUNT(*)::int AS n FROM families WHERE form_id::text = $1"],
  ];
  for (const [table, sql] of checks) {
    try {
      const result = await client.query(sql, [String(formId)]);
      if ((result.rows[0]?.n || 0) > 0) references.push(`${table} (${result.rows[0].n})`);
    } catch (error) {
      // A table that does not exist on this schema is not a reference we can
      // ignore silently: skip the form instead of risking a broken link.
      references.push(`${table} (unreadable: ${redact(error.message)})`);
    }
  }
  return references;
}

try {
  await client.query("BEGIN");

  // ── The rows, locked for the merge ─────────────────────────────────────────
  const rows = (
    await client.query(
      `SELECT id, name, program_id, registration_id, form_id, description, created_at
         FROM families
        WHERE UPPER(TRIM(name)) = UPPER(TRIM($1))
        ORDER BY created_at ASC, id ASC
        FOR UPDATE`,
      [GROUP_NAME],
    )
  ).rows;

  console.log(`  found ${rows.length} row(s) named "${GROUP_NAME}"`);
  for (const row of rows) {
    console.log(
      `    #${row.id}  program=${row.program_id || "—"}  form=${row.form_id || "—"}  reg=${row.registration_id}  created=${row.created_at?.toISOString?.() || row.created_at}`,
    );
  }

  if (rows.length <= 1) {
    console.log("\n  Nothing to merge — one row or none.\n");
    await client.query("ROLLBACK");
    await client.end();
    process.exit(0);
  }

  // ── Canonical: the row whose form has a run, else the oldest ───────────────
  const runByFamily = new Map();
  for (const row of rows) {
    if (!row.form_id) continue;
    const result = await client.query(
      "SELECT COUNT(*)::int AS n FROM platform_form_runs WHERE form_id::text = $1",
      [String(row.form_id)],
    );
    runByFamily.set(row.id, result.rows[0]?.n || 0);
  }
  const canonical =
    [...rows].sort(
      (first, second) =>
        (runByFamily.get(second.id) || 0) - (runByFamily.get(first.id) || 0) ||
        first.id - second.id,
    )[0];
  const removed = rows.filter((row) => row.id !== canonical.id);

  console.log(`\n  keep   #${canonical.id} (form ${canonical.form_id || "—"})`);
  console.log(`  remove ${removed.map((row) => `#${row.id}`).join(", ")}\n`);

  // ── The programme the group should belong to ───────────────────────────────
  const program =
    canonical.program_id || rows.find((row) => row.program_id)?.program_id || null;
  if (program && program !== canonical.program_id) {
    const updated = await client.query(
      "UPDATE families SET program_id = $1 WHERE id = $2 AND program_id IS NULL",
      [program, canonical.id],
    );
    expect("canonical group attached to the programme", updated, (result) => result.rowCount === 1);
  } else {
    console.log(`  ok  canonical programme already set: ${program || "—"}`);
  }

  // ── Anything keyed on the NAME follows the surviving row ───────────────────
  const contacts = await client.query(
    "UPDATE contacts SET group_name = $1 WHERE UPPER(TRIM(COALESCE(group_name, ''))) = UPPER(TRIM($2))",
    [canonical.name, GROUP_NAME],
  );
  expect("contacts filed under the surviving name", contacts, (result) => result.rowCount >= 0);

  const userGroups = await client.query(
    "UPDATE user_groups SET group_name = $1 WHERE UPPER(TRIM(COALESCE(group_name, ''))) = UPPER(TRIM($2))",
    [canonical.name, GROUP_NAME],
  );
  expect("user-group memberships filed under the surviving name", userGroups, (result) => result.rowCount >= 0);

  // ── Run assignments that target a removed row follow the survivor ─────────
  const removedTargets = removed.flatMap((row) => [
    String(row.id),
    row.registration_id,
  ]);
  const assignments = await client.query(
    `UPDATE platform_form_run_assignments
        SET target_id = $1
      WHERE target_type = 'group'
        AND target_id = ANY($2::text[])`,
    [canonical.registration_id, removedTargets],
  );
  expect("group run assignments re-pointed at the survivor", assignments, (result) => result.rowCount >= 0);

  // ── Delete the auto-created forms of the removed rows, when unused ─────────
  for (const row of removed) {
    if (!row.form_id) continue;
    const form = (
      await client.query("SELECT id, name, description FROM platform_forms WHERE id::text = $1", [
        String(row.form_id),
      ])
    ).rows[0];
    if (!form) {
      console.log(`  --  form ${row.form_id} already absent`);
      continue;
    }
    const autoCreated = String(form.description || "").startsWith("Auto-created for group:");
    const references = await formReferences(form.id);
    // The family row being removed is itself a reference: remove it from the
    // count by checking that every remaining `families` reference belongs to a
    // removed row.
    const familyRefs = await client.query(
      "SELECT id FROM families WHERE form_id::text = $1",
      [String(form.id)],
    );
    const onlyRemovedRows = familyRefs.rows.every((entry) =>
      removed.some((candidate) => candidate.id === entry.id),
    );
    const blocking = references.filter((entry) => !entry.startsWith("families"));
    if (!autoCreated || blocking.length > 0 || !onlyRemovedRows) {
      console.log(
        `  --  form ${form.id} left in place (not a free auto-created form${blocking.length ? `: ${blocking.join(", ")}` : ""})`,
      );
      continue;
    }
    const fields = await client.query(
      "DELETE FROM platform_form_fields WHERE form_id::text = $1",
      [String(form.id)],
    );
    const sections = await client.query(
      "DELETE FROM platform_form_sections WHERE form_id::text = $1",
      [String(form.id)],
    );
    const deleted = await client.query("DELETE FROM platform_forms WHERE id::text = $1", [
      String(form.id),
    ]);
    expect(
      `form ${form.id} deleted (${fields.rowCount} fields, ${sections.rowCount} sections)`,
      deleted,
      1,
    );
  }

  // ── The duplicate rows themselves ──────────────────────────────────────────
  const deletedRows = await client.query(
    "DELETE FROM families WHERE id = ANY($1::bigint[])",
    [removed.map((row) => row.id)],
  );
  expect("duplicate groups deleted", deletedRows, removed.length);

  const left = await client.query(
    "SELECT COUNT(*)::int AS n FROM families WHERE UPPER(TRIM(name)) = UPPER(TRIM($1))",
    [GROUP_NAME],
  );
  if (left.rows[0]?.n !== 1) {
    throw new Error(`post-check: expected 1 group, found ${left.rows[0]?.n} — rolling back`);
  }
  console.log("  ok  post-check: exactly one group named the same");

  if (APPLY) {
    await client.query("COMMIT");
    console.log("\n=== COMMITTED ===\n");
  } else {
    await client.query("ROLLBACK");
    console.log("\n=== SIMULATION COMPLETE — rolled back, nothing changed ===\n");
    console.log("  To apply: node scripts/db-audit/merge-duplicate-interns-groups.mjs --apply\n");
  }
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {}
  console.error(`\n  FAILED: ${redact(error.message)}`);
  console.error("  Everything was rolled back.\n");
  process.exitCode = 1;
} finally {
  await client.end();
}
