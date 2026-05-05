const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});
async function check() {
  const tables = ['families', 'v2_knowledge_bank', 'v2_knowledge_attachments'];
  for (const t of tables) {
    console.log(`--- ${t} ---`);
    const res = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${t}'`);
    console.log(JSON.stringify(res.rows, null, 2));
  }
  await pool.end();
}
check();
