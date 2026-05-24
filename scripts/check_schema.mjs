import db, { initDb } from "../src/lib/db.js";

async function checkSchema() {
  await initDb();

  // Check v2_participants columns
  const res = await db.execute({
    sql: `SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'v2_participants'
          ORDER BY ordinal_position`,
    args: [],
  });

  console.log("v2_participants columns:");
  console.log(JSON.stringify(res.rows, null, 2));

  // Check if any contacts have program_id set
  const contactsRes = await db.execute({
    sql: `SELECT COUNT(*) as cnt FROM contacts WHERE program_id IS NOT NULL`,
    args: [],
  });
  console.log(`\nContacts with program_id: ${contactsRes.rows[0]?.cnt}`);

  // Check families with program_id
  const famRes = await db.execute({
    sql: `SELECT COUNT(*) as cnt FROM families WHERE program_id IS NOT NULL`,
    args: [],
  });
  console.log(`Families with program_id: ${famRes.rows[0]?.cnt}`);
}

checkSchema().catch(console.error);
