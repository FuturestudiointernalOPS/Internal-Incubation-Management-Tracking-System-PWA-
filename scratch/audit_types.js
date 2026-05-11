
import db, { initDb } from "../src/lib/db.js";

async function audit() {
  await initDb();
  console.log("--- TYPE AUDIT START ---");
  const families = await db.execute("SELECT * FROM families LIMIT 1");
  if (families.rows.length > 0) {
    const row = families.rows[0];
    for (const key in row) {
      console.log(`${key}: ${typeof row[key]} (Value: ${row[key]})`);
    }
  } else {
    console.log("No families found.");
  }
}

audit();
