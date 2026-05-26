const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres' });
async function run() {
  await client.connect();
  try {
    const res = await client.query("SELECT * FROM v2_submissions WHERE participant_id = $1 AND program_id = $2", ['USER_1CD701CB8273', 'P-2026-EF5D63DD']);
    console.log(res.rows);
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    client.end();
  }
}
run();
