/**
 * Fix: Remove NOT NULL constraint from v2_projects.program_id
 * so internal projects can be created without a program.
 */
import db, { initDb } from '../src/lib/db.js';

async function fix() {
  await initDb();
  console.log("Fixing program_id NOT NULL constraint...\n");
  try {
    await db.execute({
      sql: "ALTER TABLE v2_projects ALTER COLUMN program_id DROP NOT NULL",
      args: [],
    });
    console.log("  ✅ program_id constraint removed");
  } catch (e) {
    console.log("  ⚠️  Could not alter column:", e.message);
    console.log("  Trying alternative approach...");
    try {
      await db.execute({
        sql: "ALTER TABLE v2_projects ALTER COLUMN program_id DROP NOT NULL",
        args: [],
      });
    } catch (e2) {
      console.log("  ❌ Failed:", e2.message);
    }
  }
  console.log("\nDone.");
  process.exit(0);
}

fix();
