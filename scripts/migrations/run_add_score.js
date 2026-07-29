// Migration: Add score column to v2_submissions
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  try {
    await pool.query('ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT NULL');
    console.log("✓ score column added");
    
    await pool.query('ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()');
    console.log("✓ updated_at column added");
    
    console.log("Migration complete!");
  } catch(e) {
    console.error("Migration error:", e.message);
  }
  await pool.end();
  process.exit(0);
}

run();
