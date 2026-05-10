import db, { initDb } from '../src/lib/db.js';

async function check() {
  await initDb();
  const res = await db.execute("PRAGMA table_info(v2_knowledge_attachments);");
  console.log("Schema:", JSON.stringify(res.rows, null, 2));
  
  const test = await db.execute("SELECT * FROM v2_knowledge_bank LIMIT 1");
  console.log("Sample Note:", JSON.stringify(test.rows, null, 2));
  
  process.exit(0);
}

check();
