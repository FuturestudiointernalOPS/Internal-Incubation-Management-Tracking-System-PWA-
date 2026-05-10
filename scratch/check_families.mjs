import db, { initDb } from '../src/lib/db.js';

async function check() {
  try {
    await initDb();
    const allFamilies = await db.execute("SELECT id, name, program_id FROM families");
    console.log("All families:", allFamilies.rows);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

check();
