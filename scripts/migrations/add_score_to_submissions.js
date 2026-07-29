// Migration: Add score column to v2_submissions
import db from "../../src/lib/db.js";

async function run() {
  try {
    await db.execute(`ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT NULL`);
    console.log("✓ score column added");
    
    await db.execute(`ALTER TABLE v2_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`);
    console.log("✓ updated_at column added");
    
    console.log("Migration complete!");
  } catch(e) {
    console.error("Migration error:", e.message);
  }
  process.exit(0);
}

run();
