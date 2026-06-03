const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://postgres.yakxdxdzuojafzdkqhjd:G8%26bM%3F!KujZwXDe@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    console.log("Testing projects query...");
    const proj = await pool.query("SELECT * FROM v2_projects WHERE 1=1 ORDER BY created_at DESC LIMIT 1");
    if (proj.rows.length > 0) {
      const pid = proj.rows[0].id;
      console.log("Project ID:", pid);
      const tasks = await pool.query(`SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked,
            SUM(CASE WHEN status = 'carried_over' THEN 1 ELSE 0 END) AS carried_over,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
            FROM tasks WHERE project_id = $1`, [pid]);
      console.log("Tasks:", tasks.rows);
    } else {
      console.log("No projects found.");
    }
  } catch (e) {
    console.error("Projects error:", e.message);
  }

  try {
    console.log("Testing analytics query...");
    const analytics = await pool.query(`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
        COUNT(*) FILTER (WHERE status = 'blocked')::int AS blocked,
        COUNT(*) FILTER (WHERE status = 'carried_over')::int AS carried_over,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
        FROM tasks`);
    console.log("Analytics tasks:", analytics.rows);
  } catch (e) {
    console.error("Analytics tasks error:", e.message);
  }

  try {
    console.log("Testing analytics report query...");
    const reports = await pool.query(`SELECT
        COUNT(*) FILTER (WHERE report_type = 'standup')::int AS standups,
        COUNT(*) FILTER (WHERE report_type = 'retro')::int AS retros
        FROM v2_op_reports WHERE week_number = $1 AND year = $2 AND status = 'submitted'`, [23, 2026]);
    console.log("Analytics reports:", reports.rows);
  } catch (e) {
    console.error("Analytics reports error:", e.message);
  }

  pool.end();
}

test();
