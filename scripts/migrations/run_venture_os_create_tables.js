const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
const DATABASE_URL = dbUrlMatch[1].trim();
console.log("✅ Found DATABASE_URL");

const { Pool } = require("pg");
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = fs.readFileSync(
  path.resolve(__dirname, "venture_os_create_tables.sql"),
  "utf-8",
);

async function run() {
  const client = await pool.connect();
  try {
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--") && !s.startsWith("/*"));

    let success = 0, errors = 0;
    for (const stmt of statements) {
      try {
        await client.query(stmt);
        console.log(`✅ ${stmt.substring(0, 100).replace(/\n/g, " ")}`);
        success++;
      } catch (err) {
        if (err.message.includes("already exists")) {
          console.log(`⏭️  ${stmt.substring(0, 80).replace(/\n/g, " ")}`);
          success++;
        } else {
          console.error(`❌ ${err.message.substring(0, 150)}`);
          errors++;
        }
      }
    }
    console.log(`\n📊 ${success} OK, ${errors} erreurs`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
