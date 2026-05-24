import db, { initDb } from "../src/lib/db.js";

async function find() {
  await initDb();

  // Find all tester contacts
  const res = await db.execute({
    sql: "SELECT cid, name, email, group_name, program_id, program_name FROM contacts WHERE name ILIKE '%tester%' OR email ILIKE '%tester%' OR email ILIKE '%test%'",
    args: [],
  });
  console.log("TESTER CONTACTS:");
  res.rows.forEach(c => console.log(`  ${c.cid} | ${c.name} | ${c.email} | group=${c.group_name} | prog=${c.program_id}`));

  // Find VALIDATION program
  const prog = await db.execute({
    sql: "SELECT id, name, status FROM v2_programs WHERE name ILIKE '%valid%'",
    args: [],
  });
  console.log("\nVALIDATION PROGRAM:");
  prog.rows.forEach(p => console.log(`  ${p.id} | ${p.name} | ${p.status}`));

  // Show all families with their program links
  const fams = await db.execute({
    sql: "SELECT id, name, program_id FROM families ORDER BY name",
    args: [],
  });
  console.log("\nALL FAMILIES:");
  fams.rows.forEach(f => console.log(`  ${f.id} | ${f.name} | program_id=${f.program_id || 'null'}`));
}

find().catch(console.error);
