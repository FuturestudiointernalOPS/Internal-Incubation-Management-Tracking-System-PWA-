const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function checkCols() {
  try {
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'v2_programs'");
    console.log('v2_programs Columns:', res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
checkCols();
