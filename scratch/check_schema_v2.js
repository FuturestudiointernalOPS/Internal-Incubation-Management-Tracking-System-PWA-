const { Pool } = require('pg');

async function checkSchema() {
  const pool = new Pool({
    connectionString: "postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'v2_programs'");
    console.log(JSON.stringify(res.rows, null, 2));
    
    const res2 = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'v2_teams'");
    console.log("TEAMS SCHEMA:");
    console.log(JSON.stringify(res2.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

checkSchema();
