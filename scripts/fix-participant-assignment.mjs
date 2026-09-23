/**
 * Fix participant program assignment.
 * Uses ES modules (mjs) to import the db module.
 *
 * 1. Finds the first active program
 * 2. Finds the participant by CID
 * 3. Inserts into participant_programs (modern approach)
 * 4. Clears the invalid contacts.program_id
 *
 * LEGACY NOTE (participant cleanup): this offline repair tool still writes
 * v2_participants. v2_participants is now read-only in the live flow and must
 * not be re-introduced; switch this script to participant_programs or retire
 * it before v2_participants is removed.
 */

import { initDb } from "../src/lib/db.js";
import db from "../src/lib/db.js";

async function fix() {
  try {
    await initDb();

    const TARGET_CID = "USR-R25KDQIN";

    // 1. Find all programs
    const programsResult = await db.execute({
      sql: "SELECT id, name FROM v2_programs ORDER BY created_at DESC",
      args: [],
    });
    console.log("\n Available programs:", programsResult.rows.length);
    programsResult.rows.forEach((program) => console.log(`   ${program.id}  →  ${program.name}`));

    if (programsResult.rows.length === 0) {
      console.log("No programs found. Create one first via the admin UI.");
      return;
    }

    // Use the first program
    const program = programsResult.rows[0];
    console.log(`\n Using program: ${program.name} (${program.id})`);

    // 2. Find the participant
    const contactsResult = await db.execute({
      sql: "SELECT cid, name, email, program_id, group_name FROM contacts WHERE cid = ?",
      args: [TARGET_CID],
    });

    if (contactsResult.rows.length === 0) {
      console.log(`Participant ${TARGET_CID} not found in contacts.`);
      return;
    }

    const contact = contactsResult.rows[0];
    console.log(`\n Participant: ${contact.name} (${contact.cid})`);
    console.log(`   Current program_id: ${contact.program_id}`);

    // 3. Insert into participant_programs (modern approach)
    try {
      await db.execute({
        sql: `INSERT INTO participant_programs (participant_id, program_id)
              VALUES (?, ?)
              ON CONFLICT (participant_id, program_id) DO NOTHING`,
        args: [contact.cid, program.id],
      });
      console.log(` Inserted into participant_programs (${contact.cid} → ${program.id})`);
    } catch (error) {
      console.log(` participant_programs insert: ${error.message}`);
    }

    // 4. Clear the invalid program_id from contacts
    await db.execute({
      sql: "UPDATE contacts SET program_id = NULL, program_name = ? WHERE cid = ?",
      args: [program.name, contact.cid],
    });
    console.log(` Cleared invalid program_id, set program_name to "${program.name}"`);

    // 5. Also try to sync v2_participants
    try {
      const existing = await db.execute({
        sql: "SELECT id FROM v2_participants WHERE email = ? AND program_id = ?",
        args: [contact.email, program.id],
      });
      if (existing.rows.length === 0) {
        await db.execute({
          sql: `INSERT INTO v2_participants (program_id, user_id, name, email, screening_status)
                VALUES (?, ?, ?, ?, 'active')`,
          args: [program.id, contact.cid, contact.name, contact.email],
        });
        console.log(` Synced v2_participants`);
      } else {
        console.log(` v2_participants already exists`);
      }
    } catch (error) {
      console.log(` v2_participants sync: ${error.message}`);
    }

    console.log("\n Done!");
    console.log("-> Disconnect and reconnect the participant");
    console.log("-> The program should now appear on the dashboard");
  } catch (err) {
    console.error(" Error:", err.message);
  }
}

fix();
