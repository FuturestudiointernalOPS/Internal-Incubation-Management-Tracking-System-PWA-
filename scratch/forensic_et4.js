const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    // Check Sessions for ET4
    const res = await pool.query("SELECT * FROM v2_sessions WHERE program_id = 'P-2026-1AA0AC1C'");
    console.log("Sessions for ET4:");
    console.log(JSON.stringify(res.rows, null, 2));

    // Check Submissions for ET4
    const subRes = await pool.query("SELECT * FROM v2_submissions WHERE program_id = 'P-2026-1AA0AC1C'");
    console.log("\nSubmissions for ET4:");
    console.log(JSON.stringify(subRes.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
