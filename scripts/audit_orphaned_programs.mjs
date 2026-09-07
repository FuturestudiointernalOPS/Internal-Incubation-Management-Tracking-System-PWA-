/**
 * AUDIT: Find and optionally clean up orphaned program references.
 *
 * Scans contacts.program_id and participant_programs for program IDs
 * that don't exist in v2_programs.
 *
 * Usage:
 *   node scripts/audit_orphaned_programs.mjs          # Dry-run (report only)
 *   node scripts/audit_orphaned_programs.mjs --fix     # Remove orphaned references
 *
 * Run from project root: cd ImpactOS-FutureStudio && node scripts/audit_orphaned_programs.mjs
 */

import db, { initDb } from "../src/lib/db.js";

async function run() {
  await initDb();

  const isFix = process.argv.includes("--fix");
  const results = { contacts: [], participantPrograms: [] };

  console.log("\n═══════════════════════════════════════════════");
  console.log("  ORPHANED PROGRAM REFERENCES AUDIT");
  console.log(`  Mode: ${isFix ? "FIX (will remove orphans)" : "DRY-RUN (report only)"}`);
  console.log("═══════════════════════════════════════════════\n");

  // ── 1. Check contacts.program_id ──────────────────────────
  console.log("📋 1. Checking contacts.program_id...\n");
  const contacts = await db.execute({
    sql: "SELECT cid, name, email, program_id FROM contacts WHERE program_id IS NOT NULL AND program_id != ''",
    args: [],
  });

  for (const c of contacts.rows) {
    const ids = String(c.program_id)
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    for (const pid of ids) {
      const exists = await db.execute({
        sql: "SELECT id, name FROM v2_programs WHERE id = ?",
        args: [pid],
      });
      if (exists.rows.length === 0) {
        results.contacts.push({
          cid: c.cid,
          name: c.name,
          email: c.email,
          programId: pid,
        });
      }
    }
  }

  if (results.contacts.length === 0) {
    console.log("  ✅ No orphaned references in contacts.program_id\n");
  } else {
    console.log(`  ⚠️  Found ${results.contacts.length} orphaned reference(s) in contacts.program_id:\n`);
    for (const r of results.contacts) {
      console.log(`    Contact: ${r.name} (${r.email})`);
      console.log(`    cid:     ${r.cid}`);
      console.log(`    Program: ${r.programId}\n`);
    }

    if (isFix) {
      console.log("  🔧 Fixing contacts.program_id...\n");
      for (const r of results.contacts) {
        const contact = contacts.rows.find((c) => c.cid === r.cid);
        if (!contact) continue;

        const currentIds = String(contact.program_id)
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);

        const validIds = [];
        for (const pid of currentIds) {
          const exists = await db.execute({
            sql: "SELECT id FROM v2_programs WHERE id = ?",
            args: [pid],
          });
          if (exists.rows.length > 0) validIds.push(pid);
        }

        const newProgramId = validIds.length > 0 ? validIds.join(",") : null;
        await db.execute({
          sql: "UPDATE contacts SET program_id = ? WHERE cid = ?",
          args: [newProgramId, r.cid],
        });
        console.log(`    ✅ ${r.name}: removed orphaned program "${r.programId}"`);
      }
      console.log();
    }
  }

  // ── 2. Check participant_programs ────────────────────────
  console.log("📋 2. Checking participant_programs...\n");

  let ppRows = [];
  try {
    const ppRes = await db.execute({
      sql: "SELECT pp.id, pp.participant_id, pp.program_id, c.name AS contact_name FROM participant_programs pp LEFT JOIN contacts c ON pp.participant_id = c.cid",
      args: [],
    });
    ppRows = ppRes.rows;
  } catch (_) {
    console.log("  ⚠️  participant_programs table does not exist. Skipping.\n");
  }

  for (const r of ppRows) {
    const exists = await db.execute({
      sql: "SELECT id FROM v2_programs WHERE id = ?",
      args: [r.program_id],
    });
    if (exists.rows.length === 0) {
      results.participantPrograms.push({
        id: r.id,
        participantId: r.participant_id,
        contactName: r.contact_name || "unknown",
        programId: r.program_id,
      });
    }
  }

  if (results.participantPrograms.length === 0) {
    console.log("  ✅ No orphaned references in participant_programs\n");
  } else {
    console.log(`  ⚠️  Found ${results.participantPrograms.length} orphaned reference(s) in participant_programs:\n`);
    for (const r of results.participantPrograms) {
      console.log(`    Participant: ${r.contactName} (${r.participantId})`);
      console.log(`    Program:     ${r.programId}\n`);
    }

    if (isFix) {
      console.log("  🔧 Fixing participant_programs...\n");
      for (const r of results.participantPrograms) {
        await db.execute({
          sql: "DELETE FROM participant_programs WHERE id = ?",
          args: [r.id],
        });
        console.log(`    ✅ Removed orphaned assignment: ${r.contactName} -> ${r.programId}`);
      }
      console.log();
    }
  }

  // ── Summary ──────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════════\n");

  const totalOrphans = results.contacts.length + results.participantPrograms.length;
  if (totalOrphans === 0) {
    console.log("  ✅ No orphaned program references found. All clean!\n");
  } else if (isFix) {
    console.log(`  ✅ Fixed ${totalOrphans} orphaned reference(s).\n`);
  } else {
    console.log(`  ⚠️  Found ${totalOrphans} orphaned reference(s).\n`);
    console.log("  Run with --fix to remove them:\n");
    console.log("    node scripts/audit_orphaned_programs.mjs --fix\n");
  }
}

run().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
