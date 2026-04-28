
const { createClient } = require("@libsql/client");
const db = createClient({
  url: "file:local.db",
});

async function listTables() {
  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
  console.log("Tables:", JSON.stringify(tables.rows.map(r => r.name), null, 2));
}

listTables();
