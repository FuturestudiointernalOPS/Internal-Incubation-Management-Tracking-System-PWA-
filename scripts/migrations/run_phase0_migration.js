// Run the Phase 0 migration against the database
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not found in environment");
  process.exit(1);
}

console.log("🔌 Connecting to database...");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  const client = await pool.connect();
  try {
    const sqlPath = path.resolve(
      __dirname,
      "../src/migrations/phase0_engineering_ops.sql",
    );
    const sql = fs.readFileSync(sqlPath, "utf-8");

    console.log("📄 Running migration: phase0_engineering_ops.sql");
    console.log("──────────────────────────────────────────");

    // Split by semicolons and run each statement
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const stmt of statements) {
      try {
        await client.query(stmt);
        console.log(`✅ ${stmt.substring(0, 80)}...`);
      } catch (err) {
        // Ignore "already exists" errors for idempotent migrations
        if (
          err.message.includes("already exists") ||
          err.message.includes("duplicate")
        ) {
          console.log(`⏭️  Already applied: ${stmt.substring(0, 60)}...`);
        } else {
          console.error(`❌ Error: ${err.message}`);
          console.error(`   Statement: ${stmt.substring(0, 100)}`);
        }
      }
    }

    console.log("──────────────────────────────────────────");
    console.log("✅ Migration complete!");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
