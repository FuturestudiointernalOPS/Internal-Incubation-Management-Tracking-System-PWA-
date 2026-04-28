
const { createClient } = require("@libsql/client");
const db = createClient({
  url: "file:local.db",
});

async function check() {
  const program = await db.execute({
    sql: "SELECT * FROM v2_programs WHERE id = ?",
    args: ["P-2026-5DAD1FD9"]
  });
  console.log("Program Details:", JSON.stringify(program.rows[0], null, 2));
}

check();
