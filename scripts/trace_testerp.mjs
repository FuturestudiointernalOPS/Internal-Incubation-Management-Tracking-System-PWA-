/**
 * TRACE: Check if testerp@gmail.com is properly assigned to Talent 4 Startup.
 *
 * Usage:
 *   node scripts/trace_testerp.mjs
 *
 * Run from: C:\Gwin Prod\ImpactOS-FutureStudio
 * Requires .env.local with DATABASE_URL pointing to production Supabase.
 */

import db, { initDb } from "../src/lib/db.js";

async function trace() {
  await initDb();

  console.log("\n═══════════════════════════════════════════════");
  console.log("  TRACE: testerp@gmail.com → Talent 4 Startup");
  console.log("═══════════════════════════════════════════════\n");

  // ── 1. Find the contact ──────────────────────────────────
  const userRes = await db.execute({
    sql: "SELECT cid, name, email, group_name, program_id, program_name, status, role FROM contacts WHERE email = ?",
    args: ["testerp@gmail.com"],
  });

  if (userRes.rows.length === 0) {
    console.log("  ❌ testerp@gmail.com NOT FOUND in contacts.\n");
    // Search for similar
    const similar = await db.execute({
      sql: "SELECT cid, name, email, group_name, status FROM contacts WHERE email ILIKE '%tester%' OR name ILIKE '%tester%' LIMIT 5",
      args: [],
    });
    if (similar.rows.length > 0) {
      console.log("  Similar contacts found:");
      similar.rows.forEach((c) =>
        console.log(`    ${c.cid} | ${c.name} | ${c.email} | group=${c.group_name} | status=${c.status}`),
      );
    }
    console.log();
    return;
  }

  const contact = userRes.rows[0];
  console.log("📌 CONTACT RECORD:");
  console.log(`  cid:          ${contact.cid}`);
  console.log(`  name:         ${contact.name}`);
  console.log(`  email:        ${contact.email}`);
  console.log(`  group_name:   ${contact.group_name}`);
  console.log(`  program_id:   ${contact.program_id}`);
  console.log(`  program_name: ${contact.program_name}`);
  console.log(`  status:       ${contact.status}`);
  console.log(`  role:         ${contact.role}`);
  console.log();

  // ── 2. Find Talent 4 Startup program ────────────────────
  const progRes = await db.execute({
    sql: "SELECT id, name, status, start_date, end_date FROM v2_programs WHERE name ILIKE '%talent%' OR name ILIKE '%startup%'",
    args: [],
  });

  console.log("📌 TALENT 4 STARTUP PROGRAM:");
  if (progRes.rows.length === 0) {
    console.log("  ❌ No program found matching 'Talent 4 Startup'");
    // Show all programs
    const allProgs = await db.execute({
      sql: "SELECT id, name, status FROM v2_programs ORDER BY created_at DESC LIMIT 20",
      args: [],
    });
    console.log("\n  All programs in database:");
    allProgs.rows.forEach((p) =>
      console.log(`    ${p.id} | ${p.name} | ${p.status}`),
    );
    console.log();
    return;
  }

  const program = progRes.rows[0];
  console.log(`  id:     ${program.id}`);
  console.log(`  name:   ${program.name}`);
  console.log(`  status: ${program.status}`);
  console.log();

  // ── 3. Check all assignment paths ────────────────────────
  const programId = program.id;
  let isAssigned = false;
  const paths = [];

  // Path 1: contacts.program_id (direct field, comma-separated)
  if (contact.program_id) {
    const ids = String(contact.program_id).split(",").map((id) => id.trim()).filter(Boolean);
    if (ids.includes(programId)) {
      isAssigned = true;
      paths.push("✅ Path 1 (contacts.program_id): ASSIGNED");
    } else {
      paths.push(`❌ Path 1 (contacts.program_id): has value "${contact.program_id}" but doesn't include this program`);
    }
  } else {
    paths.push("❌ Path 1 (contacts.program_id): NULL/empty");
  }

  // Path 2: families by group_name
  if (contact.group_name) {
    const famRes = await db.execute({
      sql: "SELECT id, name, program_id FROM families WHERE UPPER(TRIM(name)) = UPPER(TRIM(?))",
      args: [contact.group_name],
    });
    if (famRes.rows.length > 0) {
      const fam = famRes.rows[0];
      if (String(fam.program_id).trim() === programId) {
        isAssigned = true;
        paths.push(`✅ Path 2 (families): family "${fam.name}" (id=${fam.id}) → program ${fam.program_id} MATCHES`);
      } else if (fam.program_id) {
        paths.push(`❌ Path 2 (families): family "${fam.name}" is assigned to DIFFERENT program: ${fam.program_id}`);
      } else {
        paths.push(`❌ Path 2 (families): family "${fam.name}" has NO program_id`);
      }
    } else {
      paths.push(`❌ Path 2 (families): No family found with name "${contact.group_name}"`);
    }
  } else {
    paths.push("❌ Path 2 (families): group_name is NULL/empty");
  }

  // Path 3: v2_programs name match
  if (contact.group_name) {
    const nameRes = await db.execute({
      sql: "SELECT id FROM v2_programs WHERE UPPER(TRIM(name)) = UPPER(TRIM(?))",
      args: [contact.group_name],
    });
    if (nameRes.rows.length > 0) {
      if (nameRes.rows[0].id === programId) {
        isAssigned = true;
        paths.push("✅ Path 3 (program name match): group_name matches program name");
      } else {
        paths.push(`❌ Path 3 (program name match): group_name matches DIFFERENT program: ${nameRes.rows[0].id}`);
      }
    } else {
      paths.push("❌ Path 3 (program name match): No program matches group_name");
    }
  }

  // Path 4: participant_programs junction table
  try {
    const ppRes = await db.execute({
      sql: "SELECT program_id, assigned_by, source FROM participant_programs WHERE participant_id = ?",
      args: [contact.cid],
    });
    if (ppRes.rows.length > 0) {
      const found = ppRes.rows.find((r) => String(r.program_id).trim() === programId);
      if (found) {
        isAssigned = true;
        paths.push(`✅ Path 4 (participant_programs): ASSIGNED (by: ${found.assigned_by || "system"}, source: ${found.source || "manual"})`);
      } else {
        const progList = ppRes.rows.map((r) => r.program_id).join(", ");
        paths.push(`❌ Path 4 (participant_programs): has assignments [${progList}] but NOT to this program`);
      }
    } else {
      paths.push("❌ Path 4 (participant_programs): No entries found");
    }
  } catch (_) {
    paths.push("❌ Path 4 (participant_programs): Table does not exist");
  }

  // Path 5: v2_participants (direct enrollment)
  try {
    const vpRes = await db.execute({
      sql: "SELECT id, program_id, screening_status FROM v2_participants WHERE email = ?",
      args: [contact.email],
    });
    if (vpRes.rows.length > 0) {
      const found = vpRes.rows.find((r) => String(r.program_id).trim() === programId);
      if (found) {
        isAssigned = true;
        paths.push(`✅ Path 5 (v2_participants): ASSIGNED (id=${found.id}, screening=${found.screening_status})`);
      } else {
        const progList = vpRes.rows.map((r) => r.program_id).join(", ");
        paths.push(`❌ Path 5 (v2_participants): has entries [${progList}] but NOT to this program`);
      }
    } else {
      paths.push("❌ Path 5 (v2_participants): No entries found");
    }
  } catch (_) {
    paths.push("❌ Path 5 (v2_participants): Table does not exist");
  }

  // ── 4. Print Results ─────────────────────────────────────
  console.log("📌 ASSIGNMENT PATHS CHECK:");
  paths.forEach((p) => console.log(`  ${p}`));
  console.log();

  if (isAssigned) {
    console.log(`  ✅ CONCLUSION: testerp@gmail.com IS assigned to "${program.name}" (${programId})\n`);
  } else {
    console.log(`  ❌ CONCLUSION: testerp@gmail.com is NOT assigned to "${program.name}" (${programId})\n`);
    console.log("  Run the following SQL in Supabase to fix:\n");
    console.log(`  -- Insert into participant_programs (junction table):`);
    console.log(`  INSERT INTO participant_programs (participant_id, program_id, assigned_by, source)`);
    console.log(`  VALUES ('${contact.cid}', '${programId}', 'system', 'trace_fix');`);
    console.log();
    console.log(`  -- Also set contacts.program_id (legacy field):`);
    console.log(`  UPDATE contacts SET program_id = '${programId}', program_name = '${program.name}'`);
    console.log(`  WHERE email = 'testerp@gmail.com';`);
    console.log();
    console.log(`  -- Also set in v2_participants (if you want):`);
    console.log(`  INSERT INTO v2_participants (program_id, name, email, screening_status)`);
    console.log(`  VALUES ('${programId}', '${contact.name}', '${contact.email}', 'active');`);
    console.log();
  }

  // ── 5. Check participant_programs table (all entries for this user) ──
  console.log("📌 ALL participant_programs for this user:");
  try {
    const allPP = await db.execute({
      sql: "SELECT pp.*, p.name AS prog_name FROM participant_programs pp LEFT JOIN v2_programs p ON pp.program_id = p.id WHERE pp.participant_id = ?",
      args: [contact.cid],
    });
    if (allPP.rows.length === 0) {
      console.log("  (none found)");
    } else {
      allPP.rows.forEach((r) =>
        console.log(`  program_id=${r.program_id} | name=${r.prog_name || "?"} | source=${r.source || "?"}`),
      );
    }
  } catch (_) {
    console.log("  (table does not exist)");
  }
  console.log();

  // ── 6. Check if user can log in ──────────────────────────
  console.log("📌 LOGIN READINESS CHECK:");
  if (contact.status === "active" || contact.status === "approved") {
    console.log(`  ✅ Status is "${contact.status}" — login allowed`);
  } else if (contact.status === "pending") {
    console.log(`  ❌ Status is "pending" — login will be blocked`);
    console.log(`  Fix: UPDATE contacts SET status = 'active' WHERE email = 'testerp@gmail.com';`);
  } else {
    console.log(`  ⚠️  Status is "${contact.status}" — may cause issues`);
  }

  if (isAssigned) {
    console.log("  ✅ Has program assignment — will pass program check on login");
  } else {
    console.log("  ❌ No program assignment — will fail program check on login");
  }

  if (contact.group_name && contact.group_name !== "unassigned") {
    console.log(`  ✅ group_name is "${contact.group_name}" — will pass group check`);
  } else {
    console.log("  ⚠️  group_name is empty or 'unassigned' — login bypass is active (will check program assignment instead)");
  }
  console.log();

  // ── 7. Show assigned segments (families) for this program ──
  console.log("📌 FAMILIES/GROUPS assigned to this program:");
  const famsForProg = await db.execute({
    sql: "SELECT id, name FROM families WHERE program_id = ?",
    args: [programId],
  });
  if (famsForProg.rows.length === 0) {
    console.log("  (no families assigned to this program)");
  } else {
    famsForProg.rows.forEach((f) =>
      console.log(`  id=${f.id} | name="${f.name}"`),
    );
  }
  console.log();
}

trace().catch(console.error);
