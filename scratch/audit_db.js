
import db, { initDb } from "../src/lib/db.js";

async function audit() {
  await initDb();
  const programId = 'P-2026-1AA0AC1C';
  
  console.log("--- AUDIT START ---");
  
  const families = await db.execute({
    sql: "SELECT * FROM families WHERE program_id = ?",
    args: [programId]
  });
  console.log("FAMILIES LINKED TO PROGRAM:", JSON.stringify(families.rows, null, 2));
  
  const groupNames = families.rows.map(f => f.name);
  if (groupNames.length > 0) {
    const contacts = await db.execute({
      sql: `SELECT name, email, group_name FROM contacts WHERE UPPER(TRIM(group_name)) IN (${groupNames.map(() => 'UPPER(TRIM(?))').join(',')})`,
      args: groupNames
    });
    console.log("CONTACTS MATCHING BY GROUP NAME:", JSON.stringify(contacts.rows, null, 2));
  }
  
  const allContacts = await db.execute("SELECT name, email, group_name FROM contacts LIMIT 10");
  console.log("SAMPLE CONTACTS:", JSON.stringify(allContacts.rows, null, 2));
}

audit();
