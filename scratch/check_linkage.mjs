import db, { initDb } from '../src/lib/db.js';

async function check() {
  try {
    await initDb();
    const programId = 'P-2026-1AA0AC1C';
    
    console.log("--- CHECKING FAMILIES ---");
    const families = await db.execute({
      sql: "SELECT id, name, program_id FROM families WHERE program_id = ?",
      args: [programId]
    });
    console.log("Families assigned to program:", families.rows);
    
    if (families.rows.length > 0) {
      const familyNames = families.rows.map(f => f.name);
      console.log("\n--- CHECKING CONTACTS FOR GROUPS:", familyNames, "---");
      
      for (const name of familyNames) {
        const contacts = await db.execute({
          sql: "SELECT cid, name, group_name, role FROM contacts WHERE UPPER(group_name) = UPPER(?)",
          args: [name]
        });
        console.log(`Contacts in group '${name}':`, contacts.rows.length);
        if (contacts.rows.length > 0) {
          console.log("Sample contact:", contacts.rows[0]);
        }
      }
    } else {
      console.log("No families found with program_id:", programId);
      
      const allFamilies = await db.execute("SELECT name, program_id FROM families");
      console.log("All families and their program_ids:", allFamilies.rows);
    }
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

check();
