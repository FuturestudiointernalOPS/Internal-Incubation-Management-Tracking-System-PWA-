import db, { initDb } from "../src/lib/db.js";

async function run() {
  try {
    await initDb();
    const result = await db.execute({
      sql: "SELECT column_name, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'v2_teams' AND column_name = 'id'",
      args: []
    });
    console.log("ID Column Meta:", JSON.stringify(result.rows[0], null, 2));
  } catch (error) {
    console.error("Check failed:", error);
  }
}

run();
