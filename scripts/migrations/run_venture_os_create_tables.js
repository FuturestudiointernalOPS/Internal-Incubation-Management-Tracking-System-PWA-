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
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0 && !statement.startsWith("--") && !statement.startsWith("/*"));

    let success = 0, errors = 0;
    for (const statement of statements) {
      try {
        await client.query(statement);
        console.log(`✅ ${statement.substring(0, 100).replace(/\n/g, " ")}`);
        success++;
      } catch (err) {
        if (err.message.includes("already exists")) {
          console.log(`⏭️  ${statement.substring(0, 80).replace(/\n/g, " ")}`);
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
