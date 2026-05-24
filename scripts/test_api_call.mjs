import db, { initDb } from "../src/lib/db.js";

async function testApiCall() {
  await initDb();

  // Try calling the exact query the API uses
  const email = "test@gmail.com";

  console.log(`Testing API query for: ${email}\n`);

  const userRes = await db.execute({
    sql: "SELECT cid, program_id, program_name, group_name FROM contacts WHERE email = ?",
    args: [email],
  });

  if (userRes.rows.length === 0) {
    console.log("❌ Contact not found with email:", email);

    // Debug: find all contacts
    const all = await db.execute({
      sql: "SELECT cid, name, email, group_name, program_id FROM contacts LIMIT 20",
      args: [],
    });
    console.log("\nAll contacts:");
    all.rows.forEach(c => console.log(`  ${c.cid} | ${c.name} | ${c.email} | group=${c.group_name} | prog=${c.program_id}`));
    return;
  }

  const contact = userRes.rows[0];
  console.log("✅ Contact found:");
  console.log(`  cid: ${contact.cid}`);
  console.log(`  email: ${contact.email}`);
  console.log(`  group_name: ${contact.group_name}`);
  console.log(`  program_id: ${contact.program_id}`);
  console.log(`  program_name: ${contact.program_name}`);

  // Now replicate the API logic
  const programIds = new Set();

  if (contact.program_id != null) {
    const raw = String(contact.program_id);
    raw.split(",").map(id => id.trim()).filter(Boolean).forEach(id => programIds.add(id));
  }

  if (contact.group_name) {
    const familyRes = await db.execute({
      sql: "SELECT program_id FROM families WHERE UPPER(TRIM(name)) = UPPER(TRIM(?)) AND program_id IS NOT NULL",
      args: [contact.group_name],
    });
    familyRes.rows.forEach(r => {
      if (r.program_id != null) programIds.add(String(r.program_id).trim());
    });

    const groupRes = await db.execute({
      sql: "SELECT id FROM v2_programs WHERE UPPER(TRIM(name)) = UPPER(TRIM(?))",
      args: [contact.group_name],
    });
    groupRes.rows.forEach(r => {
      if (r.id != null) programIds.add(String(r.id).trim());
    });
  }

  const legacyRes = await db.execute({
    sql: "SELECT program_id FROM v2_participants WHERE email = ?",
    args: [email],
  });
  legacyRes.rows.forEach(r => {
    if (r.program_id != null) programIds.add(String(r.program_id).trim());
  });

  console.log(`\n📌 Final programIds: ${programIds.size > 0 ? [...programIds].join(", ") : "(empty)"}`);

  if (programIds.size === 0) {
    console.log("\n❌ No programs found. Why?");
  } else {
    for (const pid of programIds) {
      console.log(`\nLooking up program: ${pid}`);
      try {
        const [progRes] = await Promise.all([
          db.execute({ sql: "SELECT * FROM v2_programs WHERE id = ?", args: [pid] }),
        ]);
        const program = progRes.rows[0];
        if (!program) {
          console.log(`  ❌ Program NOT FOUND in v2_programs for id=${pid}`);
        } else {
          console.log(`  ✅ Found: ${program.name}`);
        }
      } catch (err) {
        console.log(`  ❌ Error looking up program ${pid}: ${err.message}`);
      }
    }
  }
}

testApiCall().catch(console.error);
