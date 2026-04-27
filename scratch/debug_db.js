const { initDb } = require('./src/lib/db');

async function debug() {
   const db = await initDb();
   console.log("--- SESSIONS ---");
   const sessions = await db.execute("SELECT id, title, program_id FROM v2_sessions LIMIT 5");
   console.table(sessions.rows);

   console.log("\n--- DOCUMENT REQUIREMENTS ---");
   const docs = await db.execute("SELECT id, title, program_id, session_id FROM v2_document_requirements LIMIT 10");
   console.table(docs.rows);
   
   process.exit(0);
}

debug();
