/**
 * REPAIR SCRIPT: Fix existing group-to-program assignment data
 *
 * The "Target Student Groups" UI in the admin program editor was sending
 * assigned_segments (family IDs) to the PUT route, but the route was silently
 * discarding it. This script repairs the damage by:
 *
 * 1. Finding all families that have program_id set → syncing contacts + v2_participants
 * 2. Finding all contacts that have program_id set but their family doesn't → backfilling
 * 3. Finding all v2_participants records → ensuring contacts are in sync
 *
 * Run: node scripts/repair_group_assignments.js
 */

import db, { initDb } from "../src/lib/db.js";

async function repair() {
  await initDb();

  console.log("\n═══════════════════════════════════════════════");
  console.log("  GROUP ASSIGNMENT REPAIR SCRIPT");
  console.log("═══════════════════════════════════════════════\n");

  const report = {
    familiesFixed: 0,
    contactsFixed: 0,
    participantsAdded: 0,
    errors: [],
  };

  // ─── PHASE 1: Families with program_id → sync contacts ───
  console.log("📌 PHASE 1: Families with program_id → syncing contacts\n");

  const familiesRes = await db.execute({
    sql: "SELECT * FROM families WHERE program_id IS NOT NULL",
    args: [],
  });

  console.log(
    `  Found ${familiesRes.rows.length} families with program_id set.\n`,
  );

  for (const family of familiesRes.rows) {
    const programId = family.program_id;
    const familyName = family.name;

    console.log(
      `  🔗 Processing family: "${familyName}" → program: ${programId}`,
    );

    // Get the program name
    const progRes = await db.execute({
      sql: "SELECT name FROM v2_programs WHERE id = ?",
      args: [programId],
    });
    const programName = progRes.rows[0]?.name || null;
    if (!programName) {
      console.log(`     ⚠️  Program ${programId} not found, skipping`);
      continue;
    }

    // Update contacts in this family
    const updateRes = await db.execute({
      sql: `UPDATE contacts SET program_id = ?, program_name = ? WHERE UPPER(TRIM(group_name)) = UPPER(TRIM(?)) AND (program_id IS NULL OR program_id != ?)`,
      args: [programId, programName, familyName, programId],
    });
    if (updateRes.rowsAffected > 0) {
      console.log(`     ✅ Updated ${updateRes.rowsAffected} contacts`);
      report.contactsFixed += updateRes.rowsAffected;
    }

    // Upsert into v2_participants
    const contactsRes = await db.execute({
      sql: `SELECT email, name, phone FROM contacts WHERE UPPER(TRIM(group_name)) = UPPER(TRIM(?))`,
      args: [familyName],
    });

    for (const contact of contactsRes.rows) {
      const existing = await db.execute({
        sql: `SELECT id FROM v2_participants WHERE email = ? AND program_id = ?`,
        args: [contact.email, programId],
      });
      if (existing.rows.length > 0) {
        await db.execute({
          sql: `UPDATE v2_participants SET name = ?, phone = ? WHERE email = ? AND program_id = ?`,
          args: [contact.name, contact.phone, contact.email, programId],
        });
      } else {
        await db.execute({
          sql: `INSERT INTO v2_participants (program_id, name, email, phone, screening_status)
                VALUES (?, ?, ?, ?, 'active')`,
          args: [programId, contact.name, contact.email, contact.phone],
        });
      }
      report.participantsAdded++;
    }
    if (contactsRes.rows.length > 0) {
      console.log(`     ✅ Synced ${contactsRes.rows.length} participants`);
    }
  }

  // ─── PHASE 2: Contacts with program_id but family doesn't have it ───
  console.log(
    "\n📌 PHASE 2: Contacts with program_id → backfilling families\n",
  );

  const orphanContactsRes = await db.execute({
    sql: `SELECT DISTINCT c.group_name, c.program_id, c.program_name
          FROM contacts c
          WHERE c.program_id IS NOT NULL
          AND c.group_name IS NOT NULL
          AND c.group_name != 'unassigned'
          AND c.group_name NOT IN (
            SELECT UPPER(TRIM(name)) FROM families WHERE program_id IS NOT NULL
          )`,
    args: [],
  });

  console.log(`  Found ${orphanContactsRes.rows.length} orphan groups.`);

  for (const row of orphanContactsRes.rows) {
    // Try to find the family by name
    const famRes = await db.execute({
      sql: "SELECT id FROM families WHERE UPPER(TRIM(name)) = UPPER(TRIM(?))",
      args: [row.group_name],
    });

    if (famRes.rows.length > 0) {
      const familyId = famRes.rows[0].id;
      await db.execute({
        sql: "UPDATE families SET program_id = ? WHERE id = ? AND program_id IS NULL",
        args: [row.program_id, familyId],
      });
      console.log(
        `     ✅ Backfilled family "${row.group_name}" → program ${row.program_id}`,
      );
      report.familiesFixed++;
    } else {
      console.log(
        `     ⚠️  No family record found for group "${row.group_name}"`,
      );
    }
  }

  // ─── PHASE 3: v2_participants → ensuring contact sync ───
  console.log("\n📌 PHASE 3: v2_participants → ensuring contact sync\n");

  const partRes = await db.execute({
    sql: "SELECT DISTINCT email, program_id FROM v2_participants",
    args: [],
  });

  console.log(`  Found ${partRes.rows.length} participant records.`);

  for (const p of partRes.rows) {
    if (!p.email) continue;
    // Check if contact has this program_id
    const checkRes = await db.execute({
      sql: `SELECT program_id FROM contacts WHERE email = ? AND (program_id IS NULL OR program_id != ?)`,
      args: [p.email, p.program_id],
    });
    if (checkRes.rows.length > 0) {
      await db.execute({
        sql: `UPDATE contacts SET program_id = ? WHERE email = ?`,
        args: [p.program_id, p.email],
      });
      console.log(
        `     ✅ Synced contact "${p.email}" → program ${p.program_id}`,
      );
      report.contactsFixed++;
    }
  }

  // ─── SUMMARY ───
  console.log("\n═══════════════════════════════════════════════");
  console.log("  REPAIR SUMMARY");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Families backfilled:    ${report.familiesFixed}`);
  console.log(`  Contacts synced:        ${report.contactsFixed}`);
  console.log(`  Participants upserted:  ${report.participantsAdded}`);
  console.log(`  Errors:                 ${report.errors.length}`);
  if (report.errors.length > 0) {
    report.errors.forEach((e) => console.log(`    ❌ ${e}`));
  }
  console.log("═══════════════════════════════════════════════\n");
}

repair().catch(console.error);
