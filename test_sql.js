const db = require('better-sqlite3')('./local.db');

try {
  console.log("Testing v2_projects...");
  const projects = db.prepare("SELECT * FROM v2_projects WHERE 1=1 ORDER BY created_at DESC").all();
  console.log("Projects:", projects.length);
  
  if (projects.length > 0) {
    const pid = projects[0].id;
    console.log("Testing tasks for project:", pid);
    const taskStats = db.prepare(`SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) AS blocked,
            SUM(CASE WHEN status = 'carried_over' THEN 1 ELSE 0 END) AS carried_over,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
            FROM tasks WHERE project_id = ?`).all(pid);
    console.log("Task stats:", taskStats);
    
    console.log("Testing blockers...");
    const blockerStats = db.prepare(`SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN b.status = 'active' THEN 1 ELSE 0 END) AS active
            FROM blockers b
            JOIN tasks t ON b.task_id = t.id
            WHERE t.project_id = ?`).all(pid);
    console.log("Blocker stats:", blockerStats);
  }
} catch(e) {
  console.error("Error:", e.message);
}

try {
  console.log("Testing analytics query...");
  const taskStats = db.prepare(`SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed
        FROM tasks`).all();
  console.log("Analytics task stats:", taskStats);
} catch (e) {
  console.error("Analytics Error:", e.message);
}
