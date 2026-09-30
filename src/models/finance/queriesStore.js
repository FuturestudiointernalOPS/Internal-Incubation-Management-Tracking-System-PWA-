// =============================================================================
// Finance Module — statements (REPOSITORY layer)
// Every read/write against the finance tables. The aggregation and the
// data-source resolution live in `@/services/finance/queries`.
//
// SQL is byte-identical to what used to sit inline in `models/finance/queries.js`.
//
// Layer rules (see docs/LAYER_SPLIT.md): no HTTP, one function per statement,
// no decisions.
// =============================================================================

import db from "@/lib/db";

// ─── Data sources ────────────────────────────────────────────────────────────

/** One active data source by id (or none). */
export function getActiveDataSourceById(id) {
  return db.execute(
    "SELECT id, last_sync_at, fiscal_year FROM data_sources WHERE id = ? AND status = 'active'",
    [id],
  );
}

/** The latest active external data source (the fallback when no id is given). */
export function getLatestActiveExternalDataSource() {
  return db.execute(
    `SELECT id, last_sync_at, fiscal_year
     FROM data_sources
     WHERE status = 'active' AND source_type != 'internal'
     ORDER BY fiscal_year DESC
     LIMIT 1`,
  );
}

/** The internal (manually entered) data source, if one exists. */
export function getInternalDataSource() {
  return db.execute(
    "SELECT id FROM data_sources WHERE source_type = 'internal' AND status = 'active' LIMIT 1",
  );
}

/** List all data sources, newest first (admin/settings usage). */
export async function listDataSources() {
  const result = await db.execute(
    `SELECT id, name, source_type, fiscal_year, status,
            last_sync_at, last_sync_status, sync_count
     FROM data_sources
     ORDER BY created_at DESC`,
  );
  return result.rows;
}

// ─── Budget lines ────────────────────────────────────────────────────────────

/** Total planned budget for a data source / fiscal year. */
export function getPlannedBudgetTotal(dataSourceId, fiscalYear) {
  return db.execute(
    `SELECT COALESCE(SUM(planned_amount), 0) AS total
     FROM finance_budget_lines
     WHERE data_source_id = ? AND fiscal_year = ?`,
    [dataSourceId, fiscalYear],
  );
}

/** Planned budget per program for a data source / fiscal year. */
export function listBudgetLines(dataSourceId, fiscalYear) {
  return db.execute(
    `SELECT
       bl.id,
       bl.planned_amount,
       bl.fiscal_year,
       bl.data_source_id,
       fp.id AS program_id,
       fp.code AS program_code,
       fp.name AS program_name
     FROM finance_budget_lines bl
     JOIN finance_programs fp ON fp.id = bl.program_id
     WHERE bl.data_source_id = ? AND bl.fiscal_year = ?
     ORDER BY fp.code`,
    [dataSourceId, fiscalYear],
  );
}

// ─── Transactions ────────────────────────────────────────────────────────────

/** Total archived-excluded spending (expenses). */
export function getExpenseTotal(dataSourceId) {
  return db.execute(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM finance_transactions
     WHERE data_source_id = ? AND type = 'expense' AND archived = false`,
    [dataSourceId],
  );
}

/** Total archived-excluded revenue. */
export function getRevenueTotal(dataSourceId) {
  return db.execute(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM finance_transactions
     WHERE data_source_id = ? AND type = 'revenue' AND archived = false`,
    [dataSourceId],
  );
}

/** Month-by-month totals within a fiscal window. */
export function getMonthlyTransactionTotals(dataSourceId, start, end) {
  return db.execute(
    `SELECT
       DATE_TRUNC('month', date)::DATE AS month_start,
       type,
       SUM(amount) AS total
     FROM finance_transactions
     WHERE data_source_id = ?
       AND archived = false
       AND date >= ?::DATE
       AND date <= ?::DATE
     GROUP BY DATE_TRUNC('month', date), type
     ORDER BY month_start`,
    [dataSourceId, start, end],
  );
}

/** Count the rows a caller-built WHERE fragment matches. */
export function countTransactions(whereSql, args) {
  return db.execute(
    `SELECT COUNT(*) AS total FROM finance_transactions WHERE ${whereSql}`,
    args,
  );
}

/** A page of rows matching a caller-built WHERE fragment. */
export function listTransactions(whereSql, args, limit, offset) {
  return db.execute(
    `SELECT id, date, supplier_client, description, category,
            budget_code, type, amount, program_id, data_source_id,
            created_at, updated_at
     FROM finance_transactions
     WHERE ${whereSql}
     ORDER BY date DESC, created_at DESC
     LIMIT ? OFFSET ?`,
    [...args, limit, offset],
  );
}

// ─── Program lookup ──────────────────────────────────────────────────────────

/** The program id for a budget code (or none). */
export function getProgramIdByCode(code) {
  return db.execute(
    "SELECT id FROM finance_programs WHERE code = ?",
    [code],
  );
}

/** Insert one manually entered transaction and return its id. */
export function insertFinanceTransaction({
  dataSourceId,
  programId,
  date,
  supplierClient,
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
     RETURNING id`,
    [
      dataSourceId,
      programId,
      date,
      supplierClient,
      description,
      category,
      budgetCode,
      type,
      amount,
    ],
  );
}
