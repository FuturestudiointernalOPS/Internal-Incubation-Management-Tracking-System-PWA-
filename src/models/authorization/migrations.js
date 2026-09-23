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
 * that throws is NOT recorded and retries on the next boot.
 */

import db from "@/lib/db";

let schemaPromise = null;

function ensureMigrationsSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await db.execute(`CREATE TABLE IF NOT EXISTS authz_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

  await migrationFn();
  await db.execute({
    sql: "INSERT INTO authz_migrations (name) VALUES (?) ON CONFLICT (name) DO NOTHING",
    args: [name],
  });
  // Record it locally too: a later check in the same process must not run the
  // work again. The INSERT above is what other processes and the next boot see.
  if (applied !== null) applied.add(name);
  return { applied: true };
}
