const fs = require("fs");
const path = require("path");
const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
const DATABASE_URL = dbUrlMatch[1].trim();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS kpi_progress (
        id SERIAL PRIMARY KEY,
        program_id TEXT NOT NULL,
        kpi_id INTEGER NOT NULL,
        completion_rate INTEGER DEFAULT 0,
        participant_count INTEGER DEFAULT 0,
        approved_count INTEGER DEFAULT 0,
        calculated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(program_id, kpi_id)
      )
    `);
    console.log("✅ kpi_progress cache table created (or already exists)");
    
    await client.query("CREATE INDEX IF NOT EXISTS idx_kpi_progress_program ON kpi_progress(program_id)");
    console.log("✅ Index created");
  } finally { client.release(); await pool.end(); }
}
run().catch(console.error);
