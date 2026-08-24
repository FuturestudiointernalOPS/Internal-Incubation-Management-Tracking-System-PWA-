import pg from 'pg';
const { Pool } = pg;

// SECURITY: connection string must come from the environment, never hardcoded.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL environment variable.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
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
