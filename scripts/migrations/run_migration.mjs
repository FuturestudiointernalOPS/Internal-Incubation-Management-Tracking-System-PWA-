import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log("Running migration: Remove NOT NULL from program_id...");
  try {
    await pool.query("ALTER TABLE v2_projects ALTER COLUMN program_id DROP NOT NULL");
    console.log("✅ Success! program_id constraint removed.");
  } catch (e) {
    console.log("⚠️", e.message);
  }
  await pool.end();
  process.exit(0);
}
run();
