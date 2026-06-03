const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    const tasks_col = await pool.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'project_id'");
    console.log("tasks.project_id:", tasks_col.rows);
    
    const v2_col = await pool.query("SELECT data_type FROM information_schema.columns WHERE table_name = 'v2_projects' AND column_name = 'id'");
    console.log("v2_projects.id:", v2_col.rows);
    
  } catch (e) {
    console.error("error:", e.message);
  }
  pool.end();
}

test();
