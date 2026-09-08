import db from "@/lib/db";

/**
 * Finance model — data access for finance controllers.
 *
 * Seeded from `src/app/api/finance/sync/route.js` (Wave 5 route extraction):
 * this file currently holds the one inline query that route owned and will
 * grow as the remaining `api/finance/**` routes are migrated (Wave 6).
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine.
 *  - One function per query, named after the data it returns.
 *  - SQL is byte-identical to the queries that used to live inline in the
 *    controllers, so behavior is unchanged.
 */

/** Last successful sync timestamp of a finance data source. */
export async function getDataSourceLastSyncAt(dataSourceId) {
  return db.execute({
    sql: "SELECT last_sync_at FROM data_sources WHERE id = ?",
    args: [dataSourceId],
  });
}
