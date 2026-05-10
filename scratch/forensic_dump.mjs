import db, { initDb } from '../src/lib/db.js';

async function forensic() {
  try {
    await initDb();
    console.log("--- FORENSIC DUMP: CONTACTS ---");
    const contacts = await db.execute("SELECT cid, name, email, group_name, role, program_id FROM contacts WHERE name LIKE '%USER T%' OR email LIKE '%u2@gmail.com%'");
    console.log(JSON.stringify(contacts.rows, null, 2));
    
    console.log("\n--- FORENSIC DUMP: FAMILIES ---");
    const families = await db.execute("SELECT * FROM families WHERE name = 'T4S'");
    console.log(JSON.stringify(families.rows, null, 2));
    
    console.log("\n--- FORENSIC DUMP: V2_PARTICIPANTS ---");
    const v2p = await db.execute("SELECT * FROM v2_participants WHERE program_id = 'P-2026-1AA0AC1C'");
    console.log(JSON.stringify(v2p.rows, null, 2));

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

forensic();
