const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'db.yakxdxdzuojafzdkqhjd.supabase.co',
  database: 'postgres',
  password: 'G8&bM?!KujZwXDe',
  port: 5432,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log("TABLES FOUND:", res.rows.map(r => r.table_name));
  } catch (err) {
    console.error("CONNECTION ERROR:", err.message);
  } finally {
    await pool.end();
  }
}

test();
