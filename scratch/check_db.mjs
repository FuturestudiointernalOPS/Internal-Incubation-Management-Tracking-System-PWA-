import db, { initDb } from '../src/lib/db.js';

async function check() {
  try {
    await initDb();
    const participants = await db.execute("SELECT * FROM v2_participants LIMIT 0");
    console.log("Participants Columns:", participants.columns);
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

check();
