import db, { initDb } from '../src/lib/db.js';

async function check() {
  await initDb();
  const programId = 'P-2026-1AA0AC1C';
  
  const progRes = await db.execute({
    sql: "SELECT id, name, note_id, materials FROM v2_programs WHERE id = ?",
    args: [programId]
  });
  console.log("Program Data:", JSON.stringify(progRes.rows, null, 2));
  
  if (progRes.rows.length > 0 && progRes.rows[0].note_id) {
    const noteId = progRes.rows[0].note_id;
    const kbRes = await db.execute({
      sql: "SELECT * FROM v2_knowledge_attachments WHERE CAST(note_id AS TEXT) = ?",
      args: [String(noteId)]
    });
    console.log("Knowledge Attachments:", JSON.stringify(kbRes.rows, null, 2));
  }
  
  process.exit(0);
}

check();
