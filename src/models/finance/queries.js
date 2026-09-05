// =============================================================================
// Finance Module — Postgres Queries
// All read/write operations against finance tables.
// Ticket 0 — replaces sheet-fetching in the old src/lib/finance.js
// =============================================================================

import db from "@/lib/db";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve the active data source ID.
 * If `dataSourceId` is provided, return it (validate existence).
 * Otherwise, return the latest active data source (ordered by fiscal_year desc).
 */
async function resolveDataSource(dataSourceId) {
  if (dataSourceId) {
    const result = await db.execute(
      "SELECT id, last_sync_at, fiscal_year FROM data_sources WHERE id = ? AND status = 'active'",
      [dataSourceId],
    );
    if (result.rows.length === 0) {
      throw new Error(`Data source not found or inactive: ${dataSourceId}`);
    }
    return result.rows[0];
  }

  // Fallback: latest active external source
  const result = await db.execute(
    `SELECT id, last_sync_at, fiscal_year
     FROM data_sources
     WHERE status = 'active' AND source_type != 'internal'
     ORDER BY fiscal_year DESC
     LIMIT 1`,
  );

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
  const ds = await resolveDataSource(dataSourceId);
  const fiscalYear = year || ds.fiscal_year || "2025-2026";

  // Total planned budget
  const plannedRes = await db.execute(
    `SELECT COALESCE(SUM(planned_amount), 0) AS total
     FROM finance_budget_lines
     WHERE data_source_id = ? AND fiscal_year = ?`,
    [ds.id, fiscalYear],
  );
  const totalPlannedBudget = Number(plannedRes.rows[0]?.total || 0);

  // Total actual spending (expenses)
  const spendingRes = await db.execute(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM finance_transactions
     WHERE data_source_id = ? AND type = 'expense' AND archived = false`,
    [ds.id],
  );
  const totalActualSpending = Number(spendingRes.rows[0]?.total || 0);

  // Total actual revenue
  const revenueRes = await db.execute(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM finance_transactions
     WHERE data_source_id = ? AND type = 'revenue' AND archived = false`,
    [ds.id],
  );
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
    dataSourceId: ds.id,
    lastSyncAt: ds.last_sync_at,
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
  const ds = await resolveDataSource(dataSourceId);
  const fiscalYear = year || ds.fiscal_year || "2025-2026";
  const { start, end } = parseFiscalYear(fiscalYear);

  if (!start || !end) {
    throw new Error(`Invalid fiscal year: ${fiscalYear}`);
  }

  // Fetch total planned budget for spreading
  const plannedRes = await db.execute(
    `SELECT COALESCE(SUM(planned_amount), 0) AS total
     FROM finance_budget_lines
     WHERE data_source_id = ? AND fiscal_year = ?`,
    [ds.id, fiscalYear],
  );
  const totalPlannedBudget = Number(plannedRes.rows[0]?.total || 0);
  const monthlyPlanned = Math.round(totalPlannedBudget / 12);

  // Group transactions by month and type
  const result = await db.execute(
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
    [ds.id, start, end],
  );

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
  for (let i = 0; i < 12; i++) {
    const y = i < 4 ? year1 : year2; // Sept-Dec use year1, Jan-Aug use year2
    const key = `${y}-${fiscalMonths[i]}`;
    const entry = monthMap[key] || { revenue: 0, spending: 0 };
    monthlyData.push({
      monthKey: key,
      monthLabel: monthLabels[i],
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
    dataSourceId: ds.id,
  };
}

// ─── Transactions ────────────────────────────────────────────────────────────

/**
 * GET /api/finance/transactions
 * Returns paginated, filtered transaction list.
 */
export async function getTransactions(dataSourceId, filters = {}) {
  const ds = await resolveDataSource(dataSourceId);

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
  const params = [ds.id];

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
  const countRes = await db.execute(
    `SELECT COUNT(*) AS total FROM finance_transactions WHERE ${where}`,
    params,
  );
  const total = Number(countRes.rows[0]?.total || 0);

  // Fetch paginated rows
  const dataRes = await db.execute(
    `SELECT id, date, supplier_client, description, category,
            budget_code, type, amount, program_id, data_source_id,
            created_at, updated_at
     FROM finance_transactions
     WHERE ${where}
     ORDER BY date DESC, created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    transactions: dataRes.rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
    })),
    total,
    limit,
    offset,
    dataSourceId: ds.id,
  };
}

// ─── Budget Lines ────────────────────────────────────────────────────────────

/**
 * GET /api/finance/budget-lines
 * Returns planned budget per program for a given data source / fiscal year.
 */
export async function getBudgetLines(dataSourceId, year) {
  const ds = await resolveDataSource(dataSourceId);
  const fiscalYear = year || ds.fiscal_year || "2025-2026";

  const result = await db.execute(
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
    [ds.id, fiscalYear],
  );

  return {
    budgetLines: result.rows.map((r) => ({
      id: r.id,
      programId: r.program_id,
      programCode: r.program_code,
      programName: r.program_name,
      plannedAmount: Number(r.planned_amount),
      fiscalYear: r.fiscal_year,
    })),
    dataSourceId: ds.id,
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
  const dsRes = await db.execute(
    "SELECT id FROM data_sources WHERE source_type = 'internal' AND status = 'active' LIMIT 1",
  );
  if (dsRes.rows.length === 0) {
    throw new Error("Internal data source not found. Run the schema migration first.");
  }
  const internalSourceId = dsRes.rows[0].id;

  // Look up program by budget code
  let programId = null;
  if (budget_code) {
    const progRes = await db.execute(
      "SELECT id FROM finance_programs WHERE code = ?",
      [budget_code],
    );
    if (progRes.rows.length > 0) {
      programId = progRes.rows[0].id;
    }
  }

  const result = await db.execute(
    `INSERT INTO finance_transactions
       (data_source_id, program_id, date, supplier_client, description,
        category, budget_code, type, amount)
     VALUES (?, ?, ?::DATE, ?, ?, ?, ?, ?, ?)
     RETURNING id`,
    [
      internalSourceId,
      programId,
      date,
      supplier_client || "",
      description || "",
      category || "",
      budget_code || null,
      type,
      amount,
    ],
  );

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
  const result = await db.execute(
    `SELECT id, name, source_type, fiscal_year, status,
            last_sync_at, last_sync_status, sync_count
     FROM data_sources
     ORDER BY created_at DESC`,
  );
  return result.rows;
}
