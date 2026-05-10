import db, { initDb } from "../src/lib/db.js";

async function run() {
  try {
    await initDb();
    const result = await db.execute({
      sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'v2_participants'",
      args: []
    });
    console.log("Columns:", JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error("Check failed:", error);
  }
}

run();
