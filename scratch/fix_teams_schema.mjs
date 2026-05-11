import db, { initDb } from "../src/lib/db.js";

async function run() {
  try {
    await initDb();
    console.log("Fixing v2_teams.leader_id type...");
    
    // Check current type and alter
    // We use a safe approach for Postgres: drop and recreate or alter type using USING
    await db.execute({
      sql: "ALTER TABLE v2_teams ALTER COLUMN leader_id TYPE TEXT USING leader_id::TEXT",
      args: []
    });

    console.log("Success: v2_teams.leader_id is now TEXT.");
  } catch (error) {
    console.error("Migration Failed:", error.message);
    // Fallback: if it doesn't exist, just add it as TEXT
    try {
        await db.execute({
          sql: "ALTER TABLE v2_teams ADD COLUMN IF NOT EXISTS leader_id TEXT",
          args: []
        });
        console.log("Success: leader_id column added as TEXT.");
    } catch (e) {
        console.error("Secondary Fallback Failed:", e.message);
    }
  }
}

run();
