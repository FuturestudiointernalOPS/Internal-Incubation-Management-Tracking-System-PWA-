/**
 * DEBUG: Trace why tester 2 can't see VALIDATION program
 * Run: set -a && . .env.local && node scripts/trace_participant.mjs
 */

import db, { initDb } from "../src/lib/db.js";

async function trace() {
  await initDb();

  console.log("\n═══════════════════════════════════════════════");
  console.log("  TRACE: tester 2 → VALIDATION program");
  console.log("═══════════════════════════════════════════════\n");

  // 1. Find tester 2's contact record
  const userRes = await db.execute({
    sql: "SELECT cid, name, email, group_name, program_id, program_name FROM contacts WHERE email = ?",
    args: ["test@gmail.com"],
  });

  if (userRes.rows.length === 0) {
    // Try alternate emails
    const allContacts = await db.execute({
      sql: "SELECT cid, name, email, group_name, program_id, program_name FROM contacts WHERE name ILIKE '%tester%' OR email ILIKE '%tester%' LIMIT 10",
      args: [],
    });
    console.log("  ❌ tester2@impactos.com not found. Similar contacts:");
    allContacts.rows.forEach((c) =>
      console.log(
        `    ${c.name} | ${c.email} | group=${c.group_name} | prog=${c.program_id}`,
      ),
    );
    return;
  }

  const contact = userRes.rows[0];
  console.log(`\n📌 CONTACT RECORD:`);
  console.log(`  name:        ${contact.name}`);
  console.log(`  email:       ${contact.email}`);
  console.log(`  group_name:  ${contact.group_name}`);
  console.log(`  program_id:  ${contact.program_id}`);
  console.log(`  program_name: ${contact.program_name}`);

  // 2. Check the VALIDATION program
  const progRes = await db.execute({
    sql: "SELECT id, name, status FROM v2_programs WHERE UPPER(TRIM(name)) = UPPER(TRIM('VALIDATION'))",
    args: [],
  });

  console.log(`\n📌 VALIDATION PROGRAM:`);
  if (progRes.rows.length === 0) {
    console.log("  ❌ VALIDATION program NOT FOUND in v2_programs");
    // List all programs
    const allProgs = await db.execute({
      sql: "SELECT id, name, status FROM v2_programs ORDER BY created_at DESC",
      args: [],
    });
    console.log("\n  All programs in database:");
    allProgs.rows.forEach((p) =>
      console.log(`    ${p.id} | ${p.name} | ${p.status}`),
    );
  } else {
    const prog = progRes.rows[0];
    console.log(`  id:     ${prog.id}`);
    console.log(`  name:   ${prog.name}`);
    console.log(`  status: ${prog.status}`);

    // 3. Check if families link exists
    if (contact.group_name) {
      const famRes = await db.execute({
        sql: "SELECT id, name, program_id FROM families WHERE UPPER(TRIM(name)) = UPPER(TRIM(?))",
        args: [contact.group_name],
      });
      console.log(`\n📌 FAMILY LINK (group_name → families):`);
      if (famRes.rows.length === 0) {
        console.log(
          `  ❌ No family found with name matching "${contact.group_name}"`,
        );
        // Show all families
        const allFams = await db.execute({
          sql: "SELECT id, name, program_id FROM families ORDER BY name",
          args: [],
        });
        console.log("\n  All families:");
        allFams.rows.forEach((f) =>
          console.log(
            `    ${f.id} | ${f.name} | program_id=${f.program_id || "null"}`,
          ),
        );
      } else {
        famRes.rows.forEach((f) =>
          console.log(
            `  ${f.id} | name="${f.name}" | program_id=${f.program_id || "❌ NULL"}`,
          ),
        );
      }
    }

    // 4. Check v2_participants
    const partRes = await db.execute({
      sql: "SELECT id, program_id, name, email FROM v2_participants WHERE email = ?",
      args: [contact.email],
    });
    console.log(`\n📌 V2_PARTICIPANTS for this email:`);
    if (partRes.rows.length === 0) {
      console.log("  ❌ No entry in v2_participants");
    } else {
      partRes.rows.forEach((p) =>
        console.log(
          `  id=${p.id} | program_id=${p.program_id} | name=${p.name}`,
        ),
      );
    }

    // 5. Test what the participant programs API would return
    console.log(
      `\n📌 SIMULATING /api/participant/programs?email=${contact.email}\n`,
    );

    const programIds = new Set();

    // Path 1: contacts.program_id
    if (contact.program_id != null) {
      const raw = String(contact.program_id);
      raw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .forEach((id) => programIds.add(id));
      console.log(`  ✅ Path 1 (contacts.program_id): ${raw}`);
    } else {
      console.log(`  ❌ Path 1: contacts.program_id is NULL`);
    }

    // Path 2: group_name → families
    if (contact.group_name) {
      const familyRes = await db.execute({
        sql: "SELECT program_id FROM families WHERE UPPER(TRIM(name)) = UPPER(TRIM(?)) AND program_id IS NOT NULL",
        args: [contact.group_name],
      });
      if (familyRes.rows.length > 0) {
        familyRes.rows.forEach((r) => {
          if (r.program_id != null) programIds.add(String(r.program_id).trim());
        });
        console.log(`  ✅ Path 2 (families): Found program_id(s)`);
      } else {
        console.log(
          `  ❌ Path 2 (families): No family with program_id found for group "${contact.group_name}"`,
        );
      }
    }

    // Path 3: direct program name match
    if (contact.group_name) {
      const groupRes = await db.execute({
        sql: "SELECT id FROM v2_programs WHERE UPPER(TRIM(name)) = UPPER(TRIM(?))",
        args: [contact.group_name],
      });
      if (groupRes.rows.length > 0) {
        groupRes.rows.forEach((r) => programIds.add(String(r.id).trim()));
        console.log(`  ✅ Path 3 (direct name match): Found program`);
      } else {
        console.log(`  ❌ Path 3: No program named "${contact.group_name}"`);
      }
    }

    // Path 4: v2_participants
    const legacyRes = await db.execute({
      sql: "SELECT program_id FROM v2_participants WHERE email = ?",
      args: [contact.email],
    });
    if (legacyRes.rows.length > 0) {
      legacyRes.rows.forEach((r) => {
        if (r.program_id != null) programIds.add(String(r.program_id).trim());
      });
      console.log(`  ✅ Path 4 (v2_participants): Found program_id(s)`);
    } else {
      console.log(`  ❌ Path 4: No v2_participants entry for this email`);
    }

    // Final result
    console.log(
      `\n📌 FINAL: programIds = ${programIds.size > 0 ? [...programIds].join(", ") : "(empty set)"}`,
    );

    if (programIds.size > 0) {
      for (const pid of programIds) {
        const check = await db.execute({
          sql: "SELECT id, name FROM v2_programs WHERE id = ?",
          args: [pid],
        });
        if (check.rows.length > 0) {
          console.log(
            `  ✅ v2_programs lookup: ${check.rows[0].name} (${pid})`,
          );
        } else {
          console.log(
            `  ❌ v2_programs lookup FAILED: No program with id=${pid}`,
          );
        }
      }
      console.log(
        `\n  ✅ CONCLUSION: Participant SHOULD see ${programIds.size} program(s)`,
      );
    } else {
      console.log(
        `\n  ❌ CONCLUSION: Participant will see 'No Programs Found'`,
      );
    }
  }
}

trace().catch(console.error);
