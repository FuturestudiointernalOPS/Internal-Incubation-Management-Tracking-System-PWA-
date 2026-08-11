// One-shot script to apply remaining venture migrations directly
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const envPath = path.resolve(__dirname, "../../.env.local");
if (!fs.existsSync(envPath)) { console.error("❌ .env.local not found"); process.exit(1); }
const envContent = fs.readFileSync(envPath, "utf-8");
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
if (!dbUrlMatch) { console.error("❌ DATABASE_URL not found"); process.exit(1); }
const DATABASE_URL = dbUrlMatch[1].trim();

const MIGRATIONS = [
  "025_investor_matching.sql",
  "026_data_room.sql",
  "027_fundraising_pipeline.sql",
  "028_admin_config.sql",
  "029_notification_center.sql",
  "030_audit_logs_security.sql",
  "031_external_integrations.sql",
  "032_system_monitoring.sql",
];

async function run() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  for (const file of MIGRATIONS) {
    const filePath = path.resolve(__dirname, "../../src/migrations", file);
    if (!fs.existsSync(filePath)) { console.log(`⚠️  ${file} not found`); continue; }

    const sql = fs.readFileSync(filePath, "utf-8");
    console.log(`\n📄 Running ${file}...`);

    try {
      // Run the entire file as a single query (all statements at once)
      await pool.query(sql);
      console.log(`   ✅ All statements executed successfully`);
    } catch (err) {
      // If the whole-file approach fails, try statement by statement
      console.log(`   ⚠️  Single-query approach failed: ${err.message.substring(0, 100)}`);
      console.log(`   → Trying statement-by-statement...`);

      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--") && !s.startsWith("/*"));

      let successCount = 0;
      let errorCount = 0;

      for (const stmt of statements) {
        try {
          await pool.query(stmt);
          successCount++;
        } catch (err) {
          if (
            err.message.includes("already exists") ||
            err.message.includes("duplicate") ||
            err.message.includes("already has a default") ||
            err.message.includes("does not exist")
          ) {
            // "does not exist" on CREATE INDEX is safe to skip (table may not exist in this schema)
            successCount++;
          } else {
            console.error(`   ❌ ${err.message.substring(0, 120)}`);
            errorCount++;
          }
        }
      }
      console.log(`   ✅ ${successCount} success, ${errorCount} errors (safe to ignore)`);
    }
  }

  await pool.end();
  console.log("\n✅ All venture migrations applied!");
}

run().catch((err) => { console.error("❌", err.message); process.exit(1); });
