// =============================================================================
// Finance Module — Data Ingestion & Sync (SERVICE layer)
// Fetches from Google Sheets, parses, and upserts into Postgres.
// Ticket 0 — replaces live sheet reads in the API routes.
//
// Layer (see docs/LAYER_SPLIT.md): the sheet parsing and the sync orchestration
// live here; every statement lives in `@/models/finance/ingestStore`.
// =============================================================================

// Reuse existing sheet-fetching utilities from the old finance module
import {
  fetchWorkbook,
  getSheetData,
  getSheetJSON,
  excelDateToISO,
  PROJECT_SHEETS,
} from "@/lib/finance";
import {
  getDataSourceConfig,
  buildProgramMap,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  upsertBudgetLine,
  insertFinanceTransaction,
  markDataSourceSynced,
  insertSyncLog,
  markSyncLogSuccess,
  markDataSourceSyncFailed,
  markSyncLogFailed,
} from "@/models/finance/ingestStore";

// ─── Sheet Parsing ───────────────────────────────────────────────────────────

/**
 * Parse the "Suivi budgétaire" sheet into budget line items.
 * Expects columns: A=name, AH=planned, AI=actual, AJ=variance
 * (0-indexed: 0, 33, 34, 35)
 */
function parseBudgetLines(rows, programMap) {
  const lines = [];
  for (const row of rows) {
    const name = row[0];
    if (!name || typeof name !== "string" || name.trim() === "" || name === "ELEMENTS") {
      continue;
    }

    const planned = parseFloat(row[33]) || 0;
    const code = name.startsWith("FS") ? name.substring(0, 5) : null;

    let programId = null;
    if (code && programMap[code]) {
      programId = programMap[code];
    }

    lines.push({
      name: name.trim(),
      plannedAmount: planned,
      code,
      programId,
    });
  }
  return lines;
}

/**
 * Parse the "Réalisations globales" sheet into transaction records.
 * Columns: TRIBU FUTURE STUDIO (date), __EMPTY (supplier), __EMPTY_1 (desc),
 *           __EMPTY_2 (category), __EMPTY_3 (spent), __EMPTY_4 (received),
 *           __EMPTY_6 (code)
 */
function parseTransactions(rows, programMap) {
  const transactions = [];
  for (const row of rows) {
    const dateRaw = row["TRIBU FUTURE STUDIO"] || row.__EMPTY || "";
    const date = excelDateToISO(dateRaw);
    const supplier = row.__EMPTY || "";
    const description = row.__EMPTY_1 || "";
    const category = row.__EMPTY_2 || "";
    const amountSpent = parseFloat(row.__EMPTY_3) || 0;
    const amountReceived = parseFloat(row.__EMPTY_4) || 0;
    const code = row.__EMPTY_6 || "";

    if (!date && !supplier && !description) continue;

    let programId = null;
    const budgetCode = code.trim() || null;
    if (budgetCode && programMap[budgetCode]) {
      programId = programMap[budgetCode];
    }

    // Create expense entry
    if (amountSpent > 0) {
      transactions.push({
        date,
        supplier,
        description,
        category,
        budgetCode,
        type: "expense",
        amount: amountSpent,
        programId,
      });
    }

    // Create revenue entry
    if (amountReceived > 0) {
      transactions.push({
        date,
        supplier,
        description,
        category,
        budgetCode,
        type: "revenue",
        amount: amountReceived,
        programId,
      });
    }
  }
  return transactions;
}

/**
 * Parse project-specific sheets (MTN Innovation Lab, SEME CITY, etc.)
 * Returns transactions with program lookup by sheet name.
 */
function parseProjectSheet(rows, sheetName, programMap) {
  // Map sheet names to budget codes
  const sheetCodeMap = {
    "MTN Innovation Lab_2": "FS002",
    "SEME CITY": "FS003",
  };

  const budgetCode = sheetCodeMap[sheetName] || null;
  let programId = null;
  if (budgetCode && programMap[budgetCode]) {
    programId = programMap[budgetCode];
  }

  const transactions = [];
  for (const row of rows) {
    const dateRaw = row["TRIBU FUTURE STUDIO"] || row.__EMPTY || "";
    const date = excelDateToISO(dateRaw);
    const supplier = row.__EMPTY || "";
    const description = row.__EMPTY_1 || "";
    const category = row.__EMPTY_2 || "";
    const amountSpent = parseFloat(row.__EMPTY_3) || 0;
    const amountReceived = parseFloat(row.__EMPTY_4) || 0;

    if (!date && !supplier && !description) continue;

    if (amountSpent > 0) {
      transactions.push({
        date,
        supplier,
        description,
        category,
        budgetCode,
        type: "expense",
        amount: amountSpent,
        programId,
      });
    }

    if (amountReceived > 0) {
      transactions.push({
        date,
        supplier,
        description,
        category,
        budgetCode,
        type: "revenue",
        amount: amountReceived,
        programId,
      });
    }
  }
  return transactions;
}

// ─── Ingest ──────────────────────────────────────────────────────────────────

/**
 * Core ingestion: fetch a Google Sheet, parse all relevant sheets,
 * and upsert data into Postgres tables.
 *
 * This is called by both the CLI script and the manual sync API.
 * Uses SQL transactions for all-or-nothing consistency.
 */
export async function ingestFromSheet(dataSourceId) {
  // 1. Fetch data source config
  const dataSourceResult = await getDataSourceConfig(dataSourceId);
  if (dataSourceResult.rows.length === 0) {
    throw new Error(`Data source not found: ${dataSourceId}`);
  }
  const dataSource = dataSourceResult.rows[0];

  // 2. Fetch the workbook
  await fetchWorkbook(dataSource.source_url);
  const fiscalYear = dataSource.fiscal_year || "2025-2026";

  // 3. Build program lookup
  const programMap = await buildProgramMap();

  // 4. Parse sheets
  const stats = {
    budgetLinesInserted: 0,
    budgetLinesUpdated: 0,
    transactionsInserted: 0,
    transactionsUpdated: 0,
    projectInserted: 0,
    projectUpdated: 0,
  };

  // --- Parse "Suivi budgétaire" (budget lines) ---
  const budgetSheetName = "Suivi budgétaire";
  const budgetRows = await getSheetData(budgetSheetName);
  const budgetLines = parseBudgetLines(budgetRows.slice(2), programMap);

  // --- Parse "Réalisations globales" (transactions) ---
  const txSheetName = "Réalisations globales";
  const txRows = await getSheetJSON(txSheetName);
  const transactions = parseTransactions(txRows, programMap);

  // --- Parse project-specific sheets ---
  const projectTransactions = [];
  for (const [, sheetName] of Object.entries(PROJECT_SHEETS)) {
    if (sheetName === "Réalisations globales" || sheetName === "Suivi budgétaire") {
      continue; // Already parsed above
    }
    try {
      const rows = await getSheetJSON(sheetName);
      const parsed = parseProjectSheet(rows, sheetName, programMap);
      projectTransactions.push(...parsed);
    } catch {
      // Sheet might not exist in this workbook — skip silently
    }
  }

  // 5. Begin Postgres transaction (all-or-nothing)
  await beginTransaction();

  try {
    // --- Upsert budget lines ---
    for (const line of budgetLines) {
      await upsertBudgetLine({
        dataSourceId,
        programId: line.programId,
        plannedAmount: line.plannedAmount,
        fiscalYear,
      });

      // Note: xmax check is Postgres-specific for determining insert vs update.
      // A simpler approach: track counts via returned data.
      if (budgetRows.length > 0) {
        stats.budgetLinesInserted++;
      }
    }
    // Since the RETURNING approach is complex with raw SQL,
    // we track counts by attempting insert-then-update separately.
    // Simplified: all lines are upserted, count as inserted if new.
    stats.budgetLinesInserted = budgetLines.length;

    // --- Upsert transactions (main sheet) ---
    for (const txn of transactions) {
      await insertFinanceTransaction({
        dataSourceId,
        programId: txn.programId,
        date: txn.date,
        supplier: txn.supplier,
        description: txn.description,
        category: txn.category,
        budgetCode: txn.budgetCode,
        type: txn.type,
        amount: txn.amount,
      });
    }
    stats.transactionsInserted = transactions.length;

    // --- Upsert project transactions ---
    for (const txn of projectTransactions) {
      await insertFinanceTransaction({
        dataSourceId,
        programId: txn.programId,
        date: txn.date,
        supplier: txn.supplier,
        description: txn.description,
        category: txn.category,
        budgetCode: txn.budgetCode,
        type: txn.type,
        amount: txn.amount,
      });
    }
    stats.projectInserted = projectTransactions.length;

    // 6. Commit
    await commitTransaction();
  } catch (error) {
    await rollbackTransaction();
    throw error;
  }

  // 7. Update data source metadata (outside transaction for visibility)
  await markDataSourceSynced(dataSourceId);

  return {
    success: true,
    rowsInserted:
      stats.budgetLinesInserted +
      stats.transactionsInserted +
      stats.projectInserted,
    budgetLinesInserted: stats.budgetLinesInserted,
    transactionsInserted: stats.transactionsInserted,
    projectTransactionsInserted: stats.projectInserted,
  };
}

// ─── Sync Data Source ────────────────────────────────────────────────────────

/**
 * Wrapper around ingestFromSheet that also:
 * - Validates the data source exists
 * - Logs the sync to finance_sync_log
 * - Handles errors gracefully
 */
export async function syncDataSource(dataSourceId, syncType = "manual") {
  const _startTime = new Date();

  // Create sync log entry
  const logResult = await insertSyncLog(dataSourceId, syncType);
  const logId = logResult.rows[0]?.id || logResult.lastInsertRowid;

  try {
    const result = await ingestFromSheet(dataSourceId);

    // Update sync log with success
    await markSyncLogSuccess(logId, result.rowsInserted || 0);

    return {
      success: true,
      ...result,
      syncLogId: logId,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    // Update data source with failure
    await markDataSourceSyncFailed(dataSourceId, error.message);

    // Update sync log with failure
    await markSyncLogFailed(logId, error.message);

    return {
      success: false,
      error: error.message,
      syncLogId: logId,
    };
  }
}
