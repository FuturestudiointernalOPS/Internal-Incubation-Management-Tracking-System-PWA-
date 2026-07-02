// =============================================================================
// Finance Sync — CLI Script
// Run: node scripts/sync-finance.js [--dataSourceId=<uuid> | --syncAll]
//
// For initial backfill or manual sync outside the 10s Vercel Hobby timeout.
// Usage:
//   node scripts/sync-finance.js --syncAll
//   node scripts/sync-finance.js --dataSourceId=550e8400-e29b-41d4-a716-446655440000
// =============================================================================

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

// ─── DB Connection ───────────────────────────────────────────────────────────

function getPool() {
  const envPath = path.resolve(__dirname, "../.env.local");
  const envContent = fs.readFileSync(envPath, "utf-8");
  const match = envContent.match(/DATABASE_URL=(.+)/);
  if (!match) {
    console.error("❌ DATABASE_URL not found in .env.local");
    process.exit(1);
  }
  const DATABASE_URL = match[1].trim();
  return new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
}

function toPgSql(sql) {
  let count = 0;
  return sql.replace(/\?/g, () => {
    count++;
    return `$${count}`;
  });
}

async function dbQuery(pool, sql, args = []) {
  const result = await pool.query(toPgSql(sql), args);
  return { rows: result.rows, rowCount: result.rowCount };
}

// ─── Sheet Fetching ──────────────────────────────────────────────────────────

async function fetchWorkbook(sourceUrl) {
  const res = await fetch(sourceUrl);
  const buffer = await res.arrayBuffer();
  return XLSX.read(buffer, { type: "array" });
}

function getSheetJSON(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  return sheet ? XLSX.utils.sheet_to_json(sheet, { defval: "" }) : [];
}

function getSheetData(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  return sheet ? XLSX.utils.sheet_to_json(sheet, { defval: "", header: 1 }) : [];
}

function excelDateToISO(serial) {
  if (!serial || typeof serial !== "number") return serial || "";
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return isNaN(date.getTime()) ? String(serial) : date.toISOString().split("T")[0];
}

// ─── Sheet Parsing ───────────────────────────────────────────────────────────

function parseBudgetLines(rows, programMap) {
  const lines = [];
  for (const row of rows) {
    const name = row[0];
    if (!name || typeof name !== "string" || name.trim() === "" || name === "ELEMENTS") continue;
    const planned = parseFloat(row[33]) || 0;
    const code = name.startsWith("FS") ? name.substring(0, 5) : null;
    lines.push({
      name: name.trim(),
      plannedAmount: planned,
      code,
      programId: code && programMap[code] ? programMap[code] : null,
    });
  }
  return lines;
}

function parseTransactions(rows, programMap) {
  const transactions = [];
  for (const r of rows) {
    const date = excelDateToISO(r["TRIBU FUTURE STUDIO"] || r.__EMPTY || "");
    const supplier = r.__EMPTY || "";
    const description = r.__EMPTY_1 || "";
    const category = r.__EMPTY_2 || "";
    const amountSpent = parseFloat(r.__EMPTY_3) || 0;
    const amountReceived = parseFloat(r.__EMPTY_4) || 0;
    const code = (r.__EMPTY_6 || "").trim() || null;

    if (!date && !supplier && !description) continue;

    const programId = code && programMap[code] ? programMap[code] : null;

    if (amountSpent > 0) {
      transactions.push({ date, supplier, description, category, budgetCode: code, type: "expense", amount: amountSpent, programId });
    }
    if (amountReceived > 0) {
      transactions.push({ date, supplier, description, category, budgetCode: code, type: "revenue", amount: amountReceived, programId });
    }
  }
  return transactions;
}

function parseProjectSheet(rows, sheetName, programMap) {
  const sheetCodeMap = { "MTN Innovation Lab_2": "FS002", "SEME CITY": "FS003" };
  const budgetCode = sheetCodeMap[sheetName] || null;
  const programId = budgetCode && programMap[budgetCode] ? programMap[budgetCode] : null;

  const transactions = [];
  for (const r of rows) {
    const date = excelDateToISO(r["TRIBU FUTURE STUDIO"] || r.__EMPTY || "");
    const supplier = r.__EMPTY || "";
    const description = r.__EMPTY_1 || "";
    const category = r.__EMPTY_2 || "";
    const amountSpent = parseFloat(r.__EMPTY_3) || 0;
    const amountReceived = parseFloat(r.__EMPTY_4) || 0;
    if (!date && !supplier && !description) continue;
    if (amountSpent > 0) {
      transactions.push({ date, supplier, description, category, budgetCode, type: "expense", amount: amountSpent, programId });
    }
    if (amountReceived > 0) {
      transactions.push({ date, supplier, description, category, budgetCode, type: "revenue", amount: amountReceived, programId });
    }
  }
  return transactions;
}

// ─── Ingest ──────────────────────────────────────────────────────────────────

async function ingestFromSheet(pool, dataSourceId) {
  // Fetch data source
  const dsRes = await dbQuery(pool, "SELECT source_url, fiscal_year FROM data_sources WHERE id = ?", [dataSourceId]);
  if (dsRes.rows.length === 0) throw new Error(`Data source not found: ${dataSourceId}`);
  const ds = dsRes.rows[0];
  const fiscalYear = ds.fiscal_year || "2025-2026";

  // Build program map
  const progRes = await dbQuery(pool, "SELECT id, code FROM finance_programs WHERE active = true");
  const programMap = {};
  for (const row of progRes.rows) {
    programMap[row.code] = row.id;
  }

  // Fetch workbook
  console.log("   Fetching Google Sheet...");
  const workbook = await fetchWorkbook(ds.source_url);

  const stats = { budgetLines: 0, transactions: 0, projectTransactions: 0 };

  // --- Budget lines ---
  console.log("   Parsing 'Suivi budgétaire'...");
  const budgetRows = getSheetData(workbook, "Suivi budgétaire");
  const budgetLines = parseBudgetLines(budgetRows.slice(2), programMap);

  // --- Transactions ---
  console.log("   Parsing 'Réalisations globales'...");
  const txRows = getSheetJSON(workbook, "Réalisations globales");
  const transactions = parseTransactions(txRows, programMap);

  // --- Project sheets ---
  const projectSheetNames = ["MTN Innovation Lab_2", "SEME CITY"];
  const projectTransactions = [];
  for (const sheetName of projectSheetNames) {
    try {
      const rows = getSheetJSON(workbook, sheetName);
      if (rows.length > 0) {
        projectTransactions.push(...parseProjectSheet(rows, sheetName, programMap));
      }
    } catch { /* skip if sheet doesn't exist */ }
  }

  // Begin transaction
  console.log("   Writing to Postgres...");
  await pool.query("BEGIN");

  try {
    // Upsert budget lines
    for (const line of budgetLines) {
      if (line.programId) {
        await pool.query(
          toPgSql(`INSERT INTO finance_budget_lines (data_source_id, program_id, planned_amount, fiscal_year)
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT (data_source_id, program_id, fiscal_year)
                   DO UPDATE SET planned_amount = EXCLUDED.planned_amount, updated_at = NOW()`),
          [dataSourceId, line.programId, line.plannedAmount, fiscalYear],
        );
        stats.budgetLines++;
      }
    }

    // Upsert transactions (main sheet)
    for (const txn of transactions) {
      await pool.query(
        toPgSql(`INSERT INTO finance_transactions
                   (data_source_id, program_id, date, supplier_client, description, category, budget_code, type, amount)
                 VALUES ($1, $2, $3::DATE, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (id) DO NOTHING`),
        [dataSourceId, txn.programId, txn.date, txn.supplier, txn.description, txn.category, txn.budgetCode, txn.type, txn.amount],
      );
      stats.transactions++;
    }

    // Upsert project transactions
    for (const txn of projectTransactions) {
      await pool.query(
        toPgSql(`INSERT INTO finance_transactions
                   (data_source_id, program_id, date, supplier_client, description, category, budget_code, type, amount)
                 VALUES ($1, $2, $3::DATE, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (id) DO NOTHING`),
        [dataSourceId, txn.programId, txn.date, txn.supplier, txn.description, txn.category, txn.budgetCode, txn.type, txn.amount],
      );
      stats.projectTransactions++;
    }

    await pool.query("COMMIT");
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }

  // Update data source metadata
  await pool.query(
    toPgSql(`UPDATE data_sources
             SET last_sync_at = NOW(), last_sync_status = 'success', last_sync_error = NULL, sync_count = sync_count + 1
             WHERE id = $1`),
    [dataSourceId],
  );

  // Log sync
  await pool.query(
    toPgSql(`INSERT INTO finance_sync_log (data_source_id, sync_type, started_at, completed_at, status, rows_inserted)
             VALUES ($1, 'cli', NOW() - INTERVAL '1 second', NOW(), 'success', $2)`),
    [dataSourceId, stats.budgetLines + stats.transactions + stats.projectTransactions],
  );

  return stats;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const syncAll = args.includes("--syncAll");
  const dsArg = args.find((a) => a.startsWith("--dataSourceId="));
  const dataSourceId = dsArg ? dsArg.split("=")[1] : null;

  if (!syncAll && !dataSourceId) {
    console.error("Usage:");
    console.error("  node scripts/sync-finance.js --syncAll");
    console.error("  node scripts/sync-finance.js --dataSourceId=<uuid>");
    process.exit(1);
  }

  console.log("🔧 Connecting to database...");
  const pool = getPool();
  console.log("✅ Connected.\n");

  if (syncAll) {
    const res = await dbQuery(pool,
      "SELECT id, name, fiscal_year FROM data_sources WHERE status = 'active' AND source_type != 'internal'",
    );
    if (res.rows.length === 0) {
      console.log("⚠️  No active external data sources found.");
      await pool.end();
      process.exit(0);
    }

    for (const ds of res.rows) {
      console.log(`📊 Syncing: ${ds.name} (${ds.fiscal_year})`);
      console.log(`   ID: ${ds.id}`);
      const start = Date.now();
      try {
        const stats = await ingestFromSheet(pool, ds.id);
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`   ✅ Done in ${elapsed}s`);
        console.log(`      Budget lines: ${stats.budgetLines}`);
        console.log(`      Transactions: ${stats.transactions}`);
        console.log(`      Project txns: ${stats.projectTransactions}`);
        console.log(`      Total:        ${stats.budgetLines + stats.transactions + stats.projectTransactions}`);
      } catch (err) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.error(`   ❌ Failed after ${elapsed}s: ${err.message}`);
      }
      console.log("");
    }
  } else {
    console.log(`📊 Syncing data source: ${dataSourceId}`);
    const start = Date.now();
    try {
      const stats = await ingestFromSheet(pool, dataSourceId);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`   ✅ Done in ${elapsed}s`);
      console.log(`      Budget lines: ${stats.budgetLines}`);
      console.log(`      Transactions: ${stats.transactions}`);
      console.log(`      Project txns: ${stats.projectTransactions}`);
    } catch (err) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.error(`   ❌ Failed after ${elapsed}s: ${err.message}`);
      await pool.end();
      process.exit(1);
    }
  }

  await pool.end();
  console.log("✅ All done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err.message);
  process.exit(1);
});
