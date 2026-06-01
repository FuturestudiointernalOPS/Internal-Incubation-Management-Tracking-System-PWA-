import db, { initDb } from "./src/lib/db.js";

async function fix() {
  await initDb();
  try {
    await db.execute({
      sql: "CREATE TABLE IF NOT EXISTS v2_project_staff (id SERIAL PRIMARY KEY, project_id TEXT NOT NULL, staff_id TEXT NOT NULL, role TEXT DEFAULT 'member', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(project_id, staff_id))",
      args: [],
    });
    console.log("OK");
  } catch (e) {
    console.log("FAIL:", e.message);
  }
  process.exit(0);
}
fix();
