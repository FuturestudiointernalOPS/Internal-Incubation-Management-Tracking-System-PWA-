const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
const DATABASE_URL = dbUrlMatch[1].trim();
console.log("✅ DATABASE_URL found");

const { Pool } = require("pg");
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = fs.readFileSync(
  path.resolve(__dirname, "venture_os_investment_readiness.sql"),
  "utf-8"
);

async function run() {
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("✅ Investment Readiness migration complete!\n");

    const tables = [
      "investment_assessments",
      "investment_scores",
      "investment_recommendations",
      "investment_history"
    ];

    for (const t of tables) {
      const res = await client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
        [t]
      );
      console.log(`   ${res.rows[0].exists ? '✅' : '❌'} ${t}`);
    }
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
