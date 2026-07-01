import db, { initDb } from "../src/lib/db.js";

async function migrate() {
  await initDb();

  // Create attendance table
  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS v2_attendance (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        program_id TEXT NOT NULL,
        participant_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'excused', 'late')),
        date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      args: [],
    });
    console.log("✅ v2_attendance table ready");
  } catch (e) {
    console.error("Migration error:", e.message);
    process.exit(1);
  }
}

migrate().catch(console.error);
