/**
 * ImpactOS — Authorization Foundation: ONE-TIME MIGRATIONS
 *
 * Once the Permissions UI becomes the source of truth for eligibility
 * configuration, boot-time code must STOP fighting the database. Policy
 * DELETEs (messaging MVP, eligibility policy #3) and the eligibility
 * bootstrap seed run exactly ONCE per database, then the administrator owns
 * the rows.
 *
 * The `authz_migrations` table records applied migrations (self-healing
 * CREATE TABLE IF NOT EXISTS — no schema migration required). A migration
 * that throws is NOT recorded and retries when migrations are next run.
 *
 * NOTHING HERE RUNS AT STARTUP: `oneTimeMigrationsEnabled()` gates every batch
 * (see that function's note).
 */

import db from "@/lib/db";

/**
 * ONE-TIME MIGRATIONS DO NOT RUN AT STARTUP — by default.
 *
 * They are all applied on every deployed database, so a boot had nothing left to
 * do but read the ledger: ~35 round trips per cold process, and — for any
 * migration whose marker was never written — a broken statement retried on every
 * restart, at error level, forever. Two did exactly that.
 *
 * So the boot path no longer applies them. To apply them DELIBERATELY (a fresh
 * database, a new environment, or a newly added migration), start the app once
 * with `AUTHZ_RUN_MIGRATIONS=true`, then remove the variable: each migration is
 * recorded in `authz_migrations` and never repeats.
 */
export const oneTimeMigrationsEnabled = () =>
  process.env.AUTHZ_RUN_MIGRATIONS === "true";

let schemaPromise = null;

function ensureMigrationsSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db.execute(`CREATE TABLE IF NOT EXISTS authz_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`);
      // DURABLE FAILURE RECORD. A failed migration is rolled back and its
      // marker is never written, which is correct — but the reason lived only
      // in the server log. On a serverless host that log is easy to lose, and
      // "the migration did not run" is not a diagnosis. One row per failing
      // migration, overwritten on each retry, readable from any SQL console.
      await db.execute(`CREATE TABLE IF NOT EXISTS authz_migration_failures (
        name TEXT PRIMARY KEY,
        error TEXT,
        failed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`);
      return true;
    })().catch((error) => {
      console.warn("[Authz] ensureMigrationsSchema failed:", error.message);
      schemaPromise = null;
      return false;
    });
  }
  return schemaPromise;
}

/**
 * The names already applied, read ONCE per process.
 *
 * Asking "has this one been applied?" per migration is one round trip EACH, and
 * the boot batch asks about thirty names - so a cold process paid thirty round
 * trips to learn one small list that only changes on deploy. Reading it whole is
 * one round trip, and on an already-migrated database (every production one) that
 * single read is the ENTIRE cost of the batch: every check finds its name without
 * a second query.
 *
 * The read is memoised through a promise, so callers that arrive while it is in
 * flight share it rather than each starting their own - the same reason the
 * authorization resolver shares its in-flight context.
 *
 * Resolves to `null` when the ledger cannot be read at all; the caller then asks
 * about each name individually, exactly as it used to, so an unreadable ledger
 * costs speed rather than correctness.
 */
let ledgerPromise = null;

async function readLedger() {
  await ensureMigrationsSchema();
  const res = await db.execute({
    sql: "SELECT name FROM authz_migrations",
    args: [],
  });
  return new Set((res.rows || []).map((row) => String(row.name)));
}

function appliedNames() {
  if (!ledgerPromise) {
    ledgerPromise = readLedger().catch((error) => {
      console.warn(
        "[Authz] could not read the migration ledger, asking per name instead:",
        error.message,
      );
      ledgerPromise = null;
      return null;
    });
  }
  return ledgerPromise;
}

/**
 * Run `migrationFn` exactly once per database. Subsequent boots (or other server
 * instances) skip it — an administrator's eligibility configuration is
 * never silently overwritten by a re-run.
 *
 * @param {string} name  unique migration id (e.g. "eligibility-policy-3")
 * @param {Function} migrationFn  async function performing the one-time work
 * @returns {Promise<{applied: boolean}>}
 */
export async function runAuthzMigration(name, migrationFn) {
  await ensureMigrationsSchema();
  const applied = await appliedNames();

  if (applied === null) {
    // The ledger could not be read: ask about this one name, as before.
    const existing = await db.execute({
      sql: "SELECT name FROM authz_migrations WHERE name = ?",
      args: [name],
    });
    if (existing.rows.length > 0) return { applied: false };
  } else if (applied.has(name)) {
    return { applied: false };
  }

  try {
    await migrationFn();
  } catch (error) {
    // Record WHY, then let the caller keep its behaviour (catch and retry on the
    // next boot). The write itself must never mask the real failure.
    await recordFailure(name, error).catch(() => {});
    throw error;
  }

  await db.execute({
    sql: "INSERT INTO authz_migrations (name) VALUES (?) ON CONFLICT (name) DO NOTHING",
    args: [name],
  });
  // A later success clears the failure of an earlier attempt.
  await db
    .execute({ sql: "DELETE FROM authz_migration_failures WHERE name = ?", args: [name] })
    .catch(() => {});
  // Record it locally too: a later check in the same process must not run the
  // work again. The INSERT above is what other processes and the next boot see.
  if (applied !== null) applied.add(name);
  return { applied: true };
}

/** Persist the reason a migration failed, for the SQL console. */
async function recordFailure(name, error) {
  const message = String(error?.message || error || "unknown error").slice(0, 2000);
  await db.execute({
    sql: `INSERT INTO authz_migration_failures (name, error, failed_at)
          VALUES (?, ?, NOW())
          ON CONFLICT (name) DO UPDATE SET error = EXCLUDED.error, failed_at = NOW()`,
    args: [name, message],
  });
}
