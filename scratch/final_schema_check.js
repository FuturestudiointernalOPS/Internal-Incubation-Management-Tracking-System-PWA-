const { Pool } = require('pg');

async function checkSchema() {
  const pool = new Pool({
    connectionString: "postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Checking v2_weekly_reports schema...");
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'v2_weekly_reports'");
    const columns = res.rows.map(r => r.column_name);
    console.log("Columns:", columns.join(", "));
    
    if (columns.includes('report_type') && columns.includes('summary')) {
      console.log("SUCCESS: PM Reporting columns exist.");
    } else {
      console.error("FAILURE: Missing PM Reporting columns!");
    }
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
