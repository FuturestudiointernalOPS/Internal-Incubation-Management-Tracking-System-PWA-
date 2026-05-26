const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres' });
async function run() {
  await client.connect();
  try {
    const pid = 'P-2026-EF5D63DD';
    await client.query("SELECT * FROM v2_programs WHERE id = $1", [pid]);
    await client.query("SELECT * FROM v2_sessions WHERE program_id = $1 ORDER BY week_number ASC", [pid]);
    await client.query("SELECT * FROM v2_deliverables WHERE program_id = $1 ORDER BY week_number ASC", [pid]);
    await client.query("SELECT * FROM v2_followups WHERE program_id = $1 ORDER BY created_at DESC LIMIT 5", [pid]);
    console.log("All queries successful");
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    client.end();
  }
}
run();
