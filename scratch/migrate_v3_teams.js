const { createClient } = require("@libsql/client");
// require("dotenv").config({ path: ".env.local" });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function migrate() {
  console.log("🚀 Starting V3 Team Logic Migration...");

  try {
    // 1. Update v2_teams
    console.log("Updating v2_teams...");
    await db.execute("ALTER TABLE v2_teams ADD COLUMN team_username TEXT").catch(e => console.log("team_username already exists or error:", e.message));
    
    // 2. Update contacts
    console.log("Updating contacts...");
    await db.execute("ALTER TABLE contacts ADD COLUMN team_id INTEGER").catch(e => console.log("team_id in contacts already exists or error:", e.message));

    // 3. Update v2_submissions
    console.log("Updating v2_submissions...");
    await db.execute("ALTER TABLE v2_submissions ADD COLUMN team_id INTEGER").catch(e => console.log("team_id in v2_submissions already exists or error:", e.message));
    await db.execute("ALTER TABLE v2_submissions ADD COLUMN week_number INTEGER").catch(e => console.log("week_number in v2_submissions already exists or error:", e.message));
    await db.execute("ALTER TABLE v2_submissions ADD COLUMN submission_link TEXT").catch(e => console.log("submission_link already exists or error:", e.message));

    // 4. Update v2_participants
    console.log("Updating v2_participants...");
    await db.execute("ALTER TABLE v2_participants ADD COLUMN team_id INTEGER").catch(e => console.log("team_id in v2_participants already exists or error:", e.message));

    console.log("✅ Migration completed successfully.");
  } catch (error) {
    console.error("❌ Migration failed:", error);
  }
}

migrate();
