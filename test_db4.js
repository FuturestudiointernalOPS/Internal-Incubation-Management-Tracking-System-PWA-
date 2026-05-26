const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres' });
async function run() {
  await client.connect();
  try {
    const pid = 'P-2026-EF5D63DD';
    await client.query("SELECT * FROM v2_document_requirements WHERE program_id = $1 ORDER BY week_number ASC", [pid]);
    console.log("v2_document_requirements works");
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    client.end();
  }
}
run();
