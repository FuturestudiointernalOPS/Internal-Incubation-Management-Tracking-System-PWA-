import db, { initDb } from "../src/lib/db.js";

async function run() {
  console.log("Initializing v2_teams table...");
  try {
    await initDb();
    
    // Create v2_teams if it doesn't exist
    await db.execute({
      sql: `
        CREATE TABLE IF NOT EXISTS v2_teams (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          program_id UUID NOT NULL REFERENCES v2_programs(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          handler_id TEXT,
          handler_name TEXT,
          team_username TEXT UNIQUE,
          password TEXT,
          group_name TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        )
      `,
      args: []
    });

    console.log("Success: v2_teams table ready.");
  } catch (error) {
    console.error("Migration Failed:", error);
  }
}

run();
