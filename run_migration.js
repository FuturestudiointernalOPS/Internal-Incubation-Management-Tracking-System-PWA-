const { Pool } = require("pg");
const fs = require("fs");
const env = fs.readFileSync(".env.local", "utf8");
const dbUrlMatch = env.match(/DATABASE_URL="?([^"\n]+)"?/);
if (!dbUrlMatch) throw new Error("No DATABASE_URL");

const pool = new Pool({
  connectionString: dbUrlMatch[1].trim(),
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const sql = fs.readFileSync("src/migrations/add_task_resources.sql", "utf8");
  await pool.query(sql);
  console.log("Migration applied.");
  process.exit(0);
}

run().catch(console.error);
