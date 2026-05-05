const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function testQuery() {
  try {
    const id = 'P-20240504-8T094YCA';
    console.log('Testing v2_events...');
    const res = await pool.query("SELECT * FROM v2_events WHERE program_id = $1", [id]);
    console.log('Success! Rows:', res.rows.length);
  } catch (e) {
    console.error('FAILED:', e.message);
  } finally {
    await pool.end();
  }
}
testQuery();
