
const { createClient } = require("@libsql/client");
const db = createClient({
  url: "file:local.db",
});

async function check() {
  const staff = await db.execute("SELECT cid, name, program_id, program_name FROM contacts WHERE program_id IS NOT NULL");
  console.log("Staff with Program ID:", JSON.stringify(staff.rows, null, 2));
}

check();
