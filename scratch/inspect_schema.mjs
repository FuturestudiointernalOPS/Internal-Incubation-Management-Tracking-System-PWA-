import db, { initDb } from "../src/lib/db.js";

async function run() {
  try {
    await initDb();
    console.log("Inspecting database schema...");
    
    const tables = ['v2_participants', 'v2_teams'];
    
    for (const table of tables) {
        console.log(`\n--- Schema for ${table} ---`);
        const res = await db.execute({
            sql: `
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = ?
                ORDER BY ordinal_position
            `,
            args: [table]
        });
        console.table(res.rows);
    }

  } catch (error) {
    console.error("Inspection Failed:", error.message);
  }
}

run();
