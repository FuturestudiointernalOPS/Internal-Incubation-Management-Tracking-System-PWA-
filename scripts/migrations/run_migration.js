// Read env file manually and run migration
const fs = require("fs");
const path = require("path");

// Read .env.local manually
const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");

// Extract DATABASE_URL
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
if (!dbUrlMatch) {
  console.error("❌ DATABASE_URL not found in .env.local");
  process.exit(1);
}

const DATABASE_URL = dbUrlMatch[1].trim();
console.log("✅ Found DATABASE_URL");

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = fs.readFileSync(
  path.resolve(__dirname, "../src/migrations/phase0_engineering_ops.sql"),
  "utf-8",
);

async function run() {
  const client = await pool.connect();
  try {
    // Filter out comments and empty lines, keep statements
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--") && !s.startsWith("/*"));

    for (const stmt of statements) {
      try {
        await client.query(stmt);
        console.log(`✅ ${stmt.substring(0, 100)}`);
      } catch (err) {
        if (
          err.message.includes("already exists")
        ) {
          console.log(`⏭️  ${stmt.substring(0, 80)} — already exists`);
        } else {
          console.error(`❌ ${err.message.substring(0, 100)}`);
        }
      }
    }
    console.log("\n✅ Migration complete!");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
