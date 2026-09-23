// =============================================================================
// KPI Progress Migration Runner
// Run: node scripts/run_kpi_progress_migration.mjs
// Creates the kpi_progress table in Supabase/PostgreSQL
// =============================================================================
import pgModule from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pgModule;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not set.");
  console.error("");
  console.error(
    "  Run with: DATABASE_URL=your_supabase_url node scripts/run_kpi_progress_migration.mjs",
  );
  console.error("");
  process.exit(1);
}

async function runMigration() {
  console.log("🔧 Running KPI Progress Migration...");
  console.log("");

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Test connection
    const testResult = await pool.query("SELECT NOW() as now");
    console.log(`✅ Database connected at ${testResult.rows[0].now}`);
    console.log("");

    const sqlPath = path.join(
      __dirname,
      "..",
      "src",
      "migrations",
      "kpi_progress_table.sql",
    );
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Split by semicolons and run each statement
    const statements = sql
      .split(";")
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0 && !statement.startsWith("--"));

    for (const statement of statements) {
      let fullStatement;
      try {
        fullStatement = statement.endsWith(";") ? statement : statement + ";";
        await pool.query(fullStatement);
        console.log(`  ✅ ${fullStatement.substring(0, 100)}...`);
      } catch (error) {
        // Ignore "already exists" errors
        if (error.message.includes("already exists")) {
          console.log(`  ⏭️  Already exists: ${fullStatement.substring(0, 80)}...`);
        } else {
          console.error(`  ❌ ERROR: ${error.message}`);
          console.error(
            `     Statement: ${fullStatement ? fullStatement.substring(0, 120) : "N/A"}`,
          );
        }
      }
    }

    console.log("");
    console.log("📋 Verifying...");

    const verificationResult = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'kpi_progress') as exists",
    );
    const tableExists = verificationResult.rows[0]?.exists;
    if (tableExists) {
      console.log("✅ TABLE kpi_progress exists!");
    } else {
      console.log("❌ TABLE kpi_progress NOT found.");
    }

    console.log("");
    console.log("🎉 Migration complete!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
