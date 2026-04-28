const { createClient } = require("@libsql/client");

const db = createClient({
  url: "file:local.db",
});

async function check() {
  try {
    const list = await db.execute("PRAGMA database_list");
    console.log("DB LIST:");
    console.table(list.rows);
    
    const res = await db.execute("PRAGMA table_info(families)");
    console.log("FAMILIES COLUMNS:");
    console.table(res.rows);
  } catch (e) {
    console.error(e);
  }
}

check();
