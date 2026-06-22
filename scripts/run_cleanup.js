/**
 * PRODUCTION CLEANUP RUNNER
 *
 * Executes the 3-step cleanup against the live Supabase database.
 *
 * Usage: node scripts/run_cleanup.js
 *
 * This will:
 *   1. Show pre-cleanup counts (what will be deleted)
 *   2. ASK for confirmation before executing the wipe
 *   3. Run the cleanup
 *   4. Show post-cleanup verification
 */

const path = require("path");
const fs = require("fs");
const readline = require("readline");
const { Pool } = require("pg");

// Load .env.local manually (no dotenv dependency needed)
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ ${filePath} not found`);
    return;
  }
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
loadEnv(path.join(__dirname, "..", ".env.local"));

// Use the known working connection (same as test_pg.js, test_db.js, etc.)
const DATABASE_URL =
  "postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres";

console.log("⏳ Connecting to database...");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function run(sql, label) {
  console.log(`\n▶ ${label}...`);
  const start = Date.now();
  const result = await pool.query(sql);
  const duration = Date.now() - start;

  if (result.rows?.length) {
    for (const row of result.rows) {
      // Print nicely
      if (row.info) {
        console.log(`\n${row.info}`);
        continue;
      }
      if (row.table_name && row.count !== undefined) {
        console.log(`  ${row.table_name}: ${row.count}`);
      } else if (row.check_name && row.orphans !== undefined) {
        console.log(`  ${row.check_name}: ${row.orphans}`);
      } else if (row.check_name && row.count !== undefined) {
        console.log(`  ${row.check_name}: ${row.count}`);
      } else {
        console.log(" ", JSON.stringify(row));
      }
    }
  }

  console.log(`  ✓ Done (${duration}ms)`);
  return result;
}

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   IMPACTOS PRODUCTION CLEANUP       ║");
  console.log("║   Target: Epitech.eu deployment      ║");
  console.log("╚══════════════════════════════════════╝");

  try {
    // Test connection
    await pool.query("SELECT 1");
    console.log("✓ Database connected");
  } catch (e) {
    console.error("❌ Database connection failed:", e.message);
    process.exit(1);
  }

  // ==========================================
  // STEP 1: Pre-cleanup counts
  // ==========================================
  console.log("\n═══════════════════════════════════════");
  console.log("  STEP 1: PRE-CLEANUP RECORD COUNTS");
  console.log("═══════════════════════════════════════");

  const step1 = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "src",
      "migrations",
      "cleanup",
      "step1_pre_counts.sql",
    ),
    "utf8",
  );

  // Split into individual SQL statements (each ends with ; then newline)
  const step1Statements = step1
    .split(/;\s*\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  let step1Rows = [];
  for (const stmt of step1Statements) {
    try {
      const result = await pool.query(stmt + ";");
      if (result.rows?.length) {
        step1Rows.push(...result.rows);
      }
    } catch (e) {
      console.error(`  ⚠ Statement error: ${e.message}`);
    }
  }

  // Print results grouped
  for (const row of step1Rows) {
    if (row.info) {
      console.log(`\n${row.info}`);
    } else if (row.table_name && row.count !== undefined) {
      console.log(`  ${String(row.table_name).padEnd(35)} ${row.count}`);
    } else {
      console.log(" ", row);
    }
  }

  // ==========================================
  // CONFIRMATION
  // ==========================================
  const skipConfirm = process.argv.includes("--yes");

  if (!skipConfirm) {
    console.log("\n═══════════════════════════════════════");
    const answer = await ask(
      "⚠  EXECUTE CLEANUP? This is DESTRUCTIVE. Type 'YES WIPE' to confirm: ",
    );
    if (answer !== "yes wipe") {
      console.log("❌ Cleanup aborted.");
      await pool.end();
      process.exit(0);
    }
  } else {
    console.log(
      "\n⚠  --yes flag detected. Skipping confirmation. EXECUTING CLEANUP...",
    );
  }

  // ==========================================
  // STEP 2: Cleanup
  // ==========================================
  console.log("\n═══════════════════════════════════════");
  console.log("  STEP 2: EXECUTING CLEANUP");
  console.log("═══════════════════════════════════════");

  const step2 = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "src",
      "migrations",
      "cleanup",
      "step2_cleanup.sql",
    ),
    "utf8",
  );

  // Strip BEGIN/COMMIT — we manage the transaction
  const step2ForExecution = step2
    .replace(/^\s*BEGIN\s*;\s*/im, "")
    .replace(/\s*COMMIT\s*;\s*$/im, "");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(step2ForExecution);
    await client.query("COMMIT");
    console.log("✓ Cleanup completed successfully");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ Cleanup failed, rolled back:", e.message);
    client.release();
    await pool.end();
    process.exit(1);
  }
  client.release();

  // ==========================================
  // STEP 3: Post-cleanup verification
  // ==========================================
  console.log("\n═══════════════════════════════════════");
  console.log("  STEP 3: POST-CLEANUP VERIFICATION");
  console.log("═══════════════════════════════════════");

  const step3 = fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "src",
      "migrations",
      "cleanup",
      "step3_post_verification.sql",
    ),
    "utf8",
  );

  const step3Statements = step3
    .split(/;\s*\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  let step3Rows = [];
  for (const stmt of step3Statements) {
    try {
      const result = await pool.query(stmt + ";");
      if (result.rows?.length) {
        step3Rows.push(...result.rows);
      }
    } catch (e) {
      console.error(`  ⚠ Statement error: ${e.message}`);
    }
  }

  for (const row of step3Rows) {
    if (row.info) {
      console.log(`\n${row.info}`);
    } else if (row.table_name && row.remaining !== undefined) {
      console.log(`  ${String(row.table_name).padEnd(35)} ${row.remaining}`);
    } else if (row.check_name && row.orphans !== undefined) {
      console.log(`  ${row.check_name}: ${row.orphans}`);
    } else if (row.check_name && row.count !== undefined) {
      console.log(`  ${row.check_name}: ${row.count}`);
    } else {
      console.log(" ", row);
    }
  }

  console.log("\n═══════════════════════════════════════");
  console.log("  ✅ CLEANUP COMPLETE");
  console.log("═══════════════════════════════════════");

  await pool.end();
}

main().catch((e) => {
  console.error("❌ Fatal error:", e.message);
  pool.end();
  process.exit(1);
});
