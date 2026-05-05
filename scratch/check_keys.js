const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const pid = 'P-20240504-8T094YCA';
    const res = await pool.query("SELECT id, week_number FROM v2_sessions WHERE program_id = $1", [pid]);
    console.log('Sessions:', res.rows);
    const res2 = await pool.query("SELECT id, session_id FROM v2_document_requirements WHERE program_id = $1", [pid]);
    console.log('Docs:', res2.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
check();
