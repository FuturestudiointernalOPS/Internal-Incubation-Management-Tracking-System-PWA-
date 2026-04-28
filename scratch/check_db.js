
const { createClient } = require("@libsql/client");
const db = createClient({
  url: "file:local.db",
});

async function check() {
  const staff = await db.execute("SELECT * FROM v2_program_staff");
  console.log("Program Staff Assignments:", JSON.stringify(staff.rows, null, 2));
  const contacts = await db.execute("SELECT cid, id, name FROM contacts LIMIT 10");
  console.log("Contacts:", JSON.stringify(contacts.rows, null, 2));
  const programs = await db.execute("SELECT id, name FROM v2_programs LIMIT 10");
  console.log("Programs:", JSON.stringify(programs.rows, null, 2));
}

check();
