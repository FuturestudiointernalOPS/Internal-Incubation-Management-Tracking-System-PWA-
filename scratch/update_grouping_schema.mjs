import db, { initDb } from "../src/lib/db.js";

async function run() {
  try {
    await initDb();
    console.log("Running participants & teams migration (Type Corrected)...");
    
    // Add team_id to participants (matching v2_teams.id which is text)
    await db.execute({
      sql: "ALTER TABLE v2_participants ADD COLUMN IF NOT EXISTS team_id TEXT",
      args: []
    });

    // Add leader_id to teams (matching v2_participants.id which is integer)
    await db.execute({
      sql: "ALTER TABLE v2_teams ADD COLUMN IF NOT EXISTS leader_id INTEGER",
      args: []
    });

    console.log("Success: Schema updated.");
  } catch (error) {
    console.error("Migration Failed:", error);
  }
}

run();
