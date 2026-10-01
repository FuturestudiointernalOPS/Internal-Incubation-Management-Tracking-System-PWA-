/**
 * Finance — ingestion store (REPOSITORY layer).
 *
 * Every statement the finance sync runs: the data-source and program lookups,
 * the transaction control (BEGIN / COMMIT / ROLLBACK), the upserts, and the
 * sync-log / data-source status updates. The parsing and the orchestration live
 * in `@/services/finance/ingest`.
 *
 * SQL is byte-identical to what used to sit inline in `models/finance/ingest.js`.
 *
 * Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement, no
 * decisions.
 */

import db from "@/lib/db";

/** The data source's sheet URL and fiscal year. */
export function getDataSourceConfig(dataSourceId) {
  return db.execute(
    "SELECT source_url, fiscal_year FROM data_sources WHERE id = ?",
    [dataSourceId],
  );
}

/**
 * Build a program map: { "FS001": "uuid", "FS002": "uuid", ... } from the
 * active finance programs.
 */
export async function buildProgramMap() {
  const result = await db.execute(
    "SELECT id, code FROM finance_programs WHERE active = true",
  );
  const map = {};
  for (const row of result.rows) {
    map[row.code] = row.id;
  }
  return map;
}

// ─── Transaction control (all-or-nothing sync) ───────────────────────────────

export function beginTransaction() {
  return db.execute("BEGIN");
}

export function commitTransaction() {
  return db.execute("COMMIT");
}

export function rollbackTransaction() {
  return db.execute("ROLLBACK");
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/** Upsert one budget line, returning whether it was inserted. */
export function upsertBudgetLine({ dataSourceId, programId, plannedAmount, fiscalYear }) {
  return db.execute(
    `INSERT INTO finance_budget_lines
           (data_source_id, program_id, planned_amount, fiscal_year)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (data_source_id, program_id, fiscal_year)
         DO UPDATE SET
           planned_amount = EXCLUDED.planned_amount,
           updated_at = NOW()
         RETURNING (xmax = 0) AS inserted`,
    [dataSourceId, programId, plannedAmount, fiscalYear],
  );
}

/** Insert one finance transaction (main sheet or project sheet). */
export function insertFinanceTransaction({
  dataSourceId,
  programId,
  date,
  supplier,
  description,
  category,
  budgetCode,
  type,
  amount,
}) {
  return db.execute(
    `INSERT INTO finance_transactions
           (data_source_id, program_id, date, supplier_client, description,
            category, budget_code, type, amount)
         VALUES (?, ?, ?::DATE, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`,
    [
      dataSourceId,
      programId,
      date,
      supplier,
      description,
      category,
      budgetCode,
      type,
      amount,
    ],
  );
}

/** Stamp a successful sync on the data source. */
export function markDataSourceSynced(dataSourceId) {
  return db.execute(
    `UPDATE data_sources
     SET last_sync_at = NOW(),
         last_sync_status = 'success',
         last_sync_error = NULL,
         sync_count = sync_count + 1
     WHERE id = ?`,
    [dataSourceId],
  );
}

/** Open a sync-log entry and return its result (the caller reads the id). */
export function insertSyncLog(dataSourceId, syncType) {
  return db.execute(
    `INSERT INTO finance_sync_log (data_source_id, sync_type, started_at, status)
     VALUES (?, ?, NOW(), 'pending')
     RETURNING id`,
    [dataSourceId, syncType],
  );
}

/** Close a sync-log entry as successful. */
export function markSyncLogSuccess(logId, rowsInserted) {
  return db.execute(
    `UPDATE finance_sync_log
       SET status = 'success',
           completed_at = NOW(),
           rows_inserted = ?,
           rows_updated = 0
       WHERE id = ?`,
    [rowsInserted, logId],
  );
}

/** Stamp a failed sync on the data source. */
export function markDataSourceSyncFailed(dataSourceId, message) {
  return db.execute(
    `UPDATE data_sources
       SET last_sync_status = 'failed',
           last_sync_error = ?
       WHERE id = ?`,
    [message, dataSourceId],
  );
}

/** Close a sync-log entry as failed. */
export function markSyncLogFailed(logId, message) {
  return db.execute(
    `UPDATE finance_sync_log
       SET status = 'failed',
           completed_at = NOW(),
           error_message = ?
       WHERE id = ?`,
    [message, logId],
  );
}
