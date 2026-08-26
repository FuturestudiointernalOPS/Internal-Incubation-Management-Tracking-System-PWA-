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
    })().catch((e) => {
      console.warn("[Authz] ensureMigrationsSchema failed:", e.message);
      schemaPromise = null;
      return false;
    });
  }
  return schemaPromise;
}

/**
 * Run `fn` exactly once per database. Subsequent boots (or other server
 * instances) skip it — an administrator's eligibility configuration is
 * never silently overwritten by a re-run.
 *
 * @param {string} name  unique migration id (e.g. "eligibility-policy-3")
 * @param {Function} fn  async function performing the one-time work
 * @returns {Promise<{applied: boolean}>}
 */
export async function runAuthzMigration(name, fn) {
  await ensureMigrationsSchema();
  const existing = await db.execute({
    sql: "SELECT name FROM authz_migrations WHERE name = ?",
    args: [name],
  });
  if (existing.rows.length > 0) return { applied: false };

  await fn();
  await db.execute({
    sql: "INSERT INTO authz_migrations (name) VALUES (?) ON CONFLICT (name) DO NOTHING",
    args: [name],
  });
  return { applied: true };
}
