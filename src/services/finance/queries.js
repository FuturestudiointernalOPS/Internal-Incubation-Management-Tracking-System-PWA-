// =============================================================================
// Finance Module — reads and aggregation (SERVICE layer)
// Ticket 0 — replaces sheet-fetching in the old src/lib/finance.js
//
// Layer (see docs/LAYER_SPLIT.md): the data-source resolution, the aggregation
// and the response shaping live here; every statement lives in
// `@/models/finance/queriesStore`.
// =============================================================================

import {
  getActiveDataSourceById,
  getLatestActiveExternalDataSource,
  getInternalDataSource,
  listDataSources,
  getPlannedBudgetTotal,
  listBudgetLines,
  getExpenseTotal,
  getRevenueTotal,
  getMonthlyTransactionTotals,
  countTransactions,
  listTransactions,
  getProgramIdByCode,
  insertFinanceTransaction,
} from "@/models/finance/queriesStore";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve the active data source.
 * If `dataSourceId` is provided, return it (validate existence).
 * Otherwise, return the latest active data source (ordered by fiscal_year desc).
 */
async function resolveDataSource(dataSourceId) {
  if (dataSourceId) {
    const result = await getActiveDataSourceById(dataSourceId);
    if (result.rows.length === 0) {
      throw new Error(`Data source not found or inactive: ${dataSourceId}`);
    }
    return result.rows[0];
  }

  // Fallback: latest active external source
  const result = await getLatestActiveExternalDataSource();

  if (result.rows.length === 0) {
    throw new Error("No active data source found. Run a sync first.");
  }
  return result.rows[0];
}

/**
 * Parse a fiscal year string (e.g. "2025-2026") into start/end dates.
 * Convention: fiscal year runs Sept 1 of first year through Aug 31 of second year.
 */
function parseFiscalYear(fiscalYear) {
  if (!fiscalYear) return { start: null, end: null };
  const parts = fiscalYear.split("-");
  if (parts.length !== 2) return { start: null, end: null };
  const year1 = parseInt(parts[0], 10);
  const year2 = parseInt(parts[1], 10);
  if (isNaN(year1) || isNaN(year2)) return { start: null, end: null };
  return {
    start: `${year1}-09-01`,
    end: `${year2}-08-31`,
  };
}

// ─── Summary ─────────────────────────────────────────────────────────────────

/**
 * GET /api/finance/summary
 * Returns aggregated budget overview for a data source / fiscal year.
 */
export async function getSummary(dataSourceId, year) {
  const dataSource = await resolveDataSource(dataSourceId);
  const fiscalYear = year || dataSource.fiscal_year || "2025-2026";

  // Total planned budget
  const plannedRes = await getPlannedBudgetTotal(dataSource.id, fiscalYear);
  const totalPlannedBudget = Number(plannedRes.rows[0]?.total || 0);

  // Total actual spending (expenses)
  const spendingRes = await getExpenseTotal(dataSource.id);
  const totalActualSpending = Number(spendingRes.rows[0]?.total || 0);

  // Total actual revenue
  const revenueRes = await getRevenueTotal(dataSource.id);
  const totalActualRevenue = Number(revenueRes.rows[0]?.total || 0);

  // Calculations
  const remainingBudget = totalPlannedBudget - totalActualSpending;
  const executionRate =
    totalPlannedBudget > 0
      ? Math.round((totalActualSpending / totalPlannedBudget) * 100)
      : 0;

  return {
    totalPlannedBudget,
    totalActualSpending,
    totalActualRevenue,
    remainingBudget,
    executionRate,
    dataSourceId: dataSource.id,
    lastSyncAt: dataSource.last_sync_at,
  };
}

// ─── Monthly Breakdown ───────────────────────────────────────────────────────

/**
 * GET /api/finance/monthly
 * Returns month-by-month aggregates computed on-read from transactions.
 * Planned spending is spread evenly (annual budget / 12) since no
 * per-month planned data exists in the schema yet.
 */
export async function getMonthly(dataSourceId, year) {
  const dataSource = await resolveDataSource(dataSourceId);
  const fiscalYear = year || dataSource.fiscal_year || "2025-2026";
  const { start, end } = parseFiscalYear(fiscalYear);

  if (!start || !end) {
    throw new Error(`Invalid fiscal year: ${fiscalYear}`);
  }

  // Fetch total planned budget for spreading
  const plannedRes = await getPlannedBudgetTotal(dataSource.id, fiscalYear);
  const totalPlannedBudget = Number(plannedRes.rows[0]?.total || 0);
  const monthlyPlanned = Math.round(totalPlannedBudget / 12);

  // Group transactions by month and type
  const result = await getMonthlyTransactionTotals(dataSource.id, start, end);

  // Build month map: { "2025-09": { revenue: X, spending: Y }, ... }
  const monthMap = {};
  for (const row of result.rows) {
    const key = row.month_start.substring(0, 7); // "2025-09"
    if (!monthMap[key]) {
      monthMap[key] = { revenue: 0, spending: 0 };
    }
    if (row.type === "revenue") {
      monthMap[key].revenue += Number(row.total);
    } else {
      monthMap[key].spending += Number(row.total);
    }
  }

  // Ordered month labels (Sept → Aug)
  const fiscalMonths = [
    "09", "10", "11", "12", "01", "02", "03", "04", "05", "06", "07", "08",
  ];
  const parts = fiscalYear.split("-");
  const year1 = parts[0];
  const year2 = parts[1];

  const monthLabels = [
    "sept", "oct", "nov", "déc", "janv", "févr", "mars", "avr", "mai", "juin", "juil", "août",
  ];

  const monthlyData = [];
  for (let index = 0; index < 12; index++) {
    const calendarYear = index < 4 ? year1 : year2; // Sept-Dec use year1, Jan-Aug use year2
    const key = `${calendarYear}-${fiscalMonths[index]}`;
    const entry = monthMap[key] || { revenue: 0, spending: 0 };
    monthlyData.push({
      monthKey: key,
      monthLabel: monthLabels[index],
      plannedRevenue: 0, // Not tracked per-month yet
      actualRevenue: entry.revenue,
      plannedSpending: monthlyPlanned,
      actualSpending: entry.spending,
      variance: entry.spending - monthlyPlanned,
    });
  }

  return {
    months: monthLabels,
    data: monthlyData,
    totalPlannedBudget,
    dataSourceId: dataSource.id,
  };
}

// ─── Transactions ────────────────────────────────────────────────────────────

/**
 * GET /api/finance/transactions
 * Returns paginated, filtered transaction list.
 */
export async function getTransactions(dataSourceId, filters = {}) {
  const dataSource = await resolveDataSource(dataSourceId);

  const {
    type,
    programId,
    dateFrom,
    dateTo,
    limit = 100,
    offset = 0,
  } = filters;

  const conditions = [
    "data_source_id = ?",
    "archived = false",
  ];
  const params = [dataSource.id];

  if (type && type !== "all") {
    conditions.push("type = ?");
    params.push(type);
  }
  if (programId) {
    conditions.push("program_id = ?");
    params.push(programId);
  }
  if (dateFrom) {
    conditions.push("date >= ?::DATE");
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push("date <= ?::DATE");
    params.push(dateTo);
  }

  const where = conditions.join(" AND ");

  // Count total matching rows
  const countRes = await countTransactions(where, params);
  const total = Number(countRes.rows[0]?.total || 0);

  // Fetch paginated rows
  const dataRes = await listTransactions(where, params, limit, offset);

  return {
    transactions: dataRes.rows.map((row) => ({
      ...row,
      amount: Number(row.amount),
    })),
    total,
    limit,
    offset,
    dataSourceId: dataSource.id,
  };
}

// ─── Budget Lines ────────────────────────────────────────────────────────────

/**
 * GET /api/finance/budget-lines
 * Returns planned budget per program for a given data source / fiscal year.
 */
export async function getBudgetLines(dataSourceId, year) {
  const dataSource = await resolveDataSource(dataSourceId);
  const fiscalYear = year || dataSource.fiscal_year || "2025-2026";

  const result = await listBudgetLines(dataSource.id, fiscalYear);

  return {
    budgetLines: result.rows.map((row) => ({
      id: row.id,
      programId: row.program_id,
      programCode: row.program_code,
      programName: row.program_name,
      plannedAmount: Number(row.planned_amount),
      fiscalYear: row.fiscal_year,
    })),
    dataSourceId: dataSource.id,
  };
}

// ─── Insert Transaction ──────────────────────────────────────────────────────

/**
 * POST /api/finance/transaction
 * Insert a manually entered transaction (linked to internal data source).
 */
export async function insertTransaction({
  date,
  supplier_client,
  description,
  category,
  budget_code,
  type = "expense",
  amount,
}) {
  // Find the internal data source
  const dataSourceResult = await getInternalDataSource();
  if (dataSourceResult.rows.length === 0) {
    throw new Error("Internal data source not found. Run the schema migration first.");
  }
  const internalSourceId = dataSourceResult.rows[0].id;

  // Look up program by budget code
  let programId = null;
  if (budget_code) {
    const programResult = await getProgramIdByCode(budget_code);
    if (programResult.rows.length > 0) {
      programId = programResult.rows[0].id;
    }
  }

  const result = await insertFinanceTransaction({
    dataSourceId: internalSourceId,
    programId,
    date,
    supplierClient: supplier_client || "",
    description: description || "",
    category: category || "",
    budgetCode: budget_code || null,
    type,
    amount,
  });

  return {
    id: result.rows[0]?.id || result.lastInsertRowid,
    dataSourceId: internalSourceId,
  };
}

// ─── Data Sources ────────────────────────────────────────────────────────────

/**
 * List all data sources (for admin/settings usage).
 */
export async function getDataSources() {
  return listDataSources();
}
