// Apply all venture-related migrations
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

// Read .env.local manually (dotenv not available)
const envPath = path.resolve(__dirname, "../.env.local");
if (!fs.existsSync(envPath)) {
  console.error("❌ .env.local not found");
  process.exit(1);
}
const envContent = fs.readFileSync(envPath, "utf-8");
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
if (!dbUrlMatch) {
  console.error("❌ DATABASE_URL not found in .env.local");
  process.exit(1);
}
const DATABASE_URL = dbUrlMatch[1].trim();

const MIGRATIONS = [
  "010_ventures.sql",
  "011_venture_promotion.sql",
  "012_startup_profile.sql",
  "013_venture_schema_fix.sql",
];

async function run() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  for (const file of MIGRATIONS) {
    const filePath = path.resolve(__dirname, "../src/migrations", file);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${file} not found, skipping`);
      continue;
    }

    const sql = fs.readFileSync(filePath, "utf-8");
    console.log(`\n📄 Running ${file}...`);

    // Split by semicolons, filter out comments/empty lines
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
          err.message.includes("already has a default")
        ) {
          // Safe to ignore — idempotent
          successCount++;
        } else {
          console.error(`   ❌ ${err.message.substring(0, 120)}`);
          errorCount++;
        }
      }
    }

    console.log(`   ✅ ${successCount} statements executed, ${errorCount} errors`);
  }

  await pool.end();
  console.log("\n✅ All venture migrations applied!");
}

run().catch((err) => {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
});
